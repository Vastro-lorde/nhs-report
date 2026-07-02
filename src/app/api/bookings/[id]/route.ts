/**
 * @openapi
 * /api/bookings/{id}:
 *   patch:
 *     tags: [Bookings, Scheduling]
 *     summary: Cancel a booking
 *     description: >
 *       Cancels a booking. The fellow who made it, the mentor it was made with,
 *       or an admin may cancel. The associated slot is re-opened (if still in the
 *       future) and the other party is notified (portal + email).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, enum: [cancel] }
 *           example: { action: "cancel" }
 *     responses:
 *       200: { description: Booking cancelled }
 *       401: { description: Not authenticated }
 *       403: { description: Not permitted to cancel this booking }
 *       404: { description: Booking not found }
 *       409: { description: Booking already cancelled }
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Fellow, Mentor, User, TimeSlot, Booking } from "@/models";
import { UserRole, TimeSlotStatus, BookingStatus, NotificationType } from "@/lib/constants";
import { createNotification } from "@/lib/notify";
import { formatSlotLabel } from "@/lib/schedule-helpers";
import { bookingCancelledTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withExceptionLog(
    "PATCH /api/bookings/[id]",
    async (_request: NextRequest, { params }: Params) => {
        const { session, error } = await requireAuth();
        if (error) return error;

        const { id } = await params;
        const role = session!.user.role;
        await connectDB();

        const booking = await Booking.findById(id);
        if (!booking) return jsonError("Booking not found", 404);
        if (booking.status === BookingStatus.CANCELLED) {
            return jsonError("Booking already cancelled", 409);
        }

        // Authorization: fellow owner, mentor owner, or admin.
        let cancelledByLabel = "an administrator";
        if (role === UserRole.FELLOW) {
            const fellow = await Fellow.findOne({ authId: session!.user.id }).select("_id name").lean();
            if (!fellow || String(booking.fellow) !== String(fellow._id)) {
                return jsonError("Forbidden", 403);
            }
            cancelledByLabel = fellow.name;
        } else if (role === UserRole.MENTOR) {
            const mentor = await Mentor.findOne({ authId: session!.user.id }).select("_id").lean();
            if (!mentor || String(booking.mentor) !== String(mentor._id)) {
                return jsonError("Forbidden", 403);
            }
            const mentorUser = await User.findById(session!.user.id).select("name").lean();
            cancelledByLabel = mentorUser?.name ?? "your mentor";
        } else if (role !== UserRole.ADMIN) {
            return jsonError("Forbidden", 403);
        }

        booking.status = BookingStatus.CANCELLED;
        booking.cancelledBy = session!.user.id as unknown as typeof booking.cancelledBy;
        booking.cancelledAt = new Date();
        await booking.save();

        // Re-open the slot if it is still in the future.
        if (booking.startAt.getTime() > Date.now()) {
            await TimeSlot.updateOne(
                { _id: booking.timeSlot, status: TimeSlotStatus.BOOKED },
                { $set: { status: TimeSlotStatus.OPEN } },
            );
        }

        // Notify the other party.
        const [fellowDoc, mentorDoc] = await Promise.all([
            Fellow.findById(booking.fellow).select("name email authId").lean(),
            Mentor.findById(booking.mentor).select("authId").lean(),
        ]);
        const mentorUser = mentorDoc
            ? await User.findById(mentorDoc.authId).select("name email").lean()
            : null;

        const appUrl = env.NEXTAUTH_URL();
        const whenLabel = formatSlotLabel(booking.startAt, booking.endAt);
        const cancelledByFellow = role === UserRole.FELLOW;

        if (cancelledByFellow && mentorUser) {
            // Notify the mentor.
            await createNotification({
                recipient: mentorDoc!.authId,
                type: NotificationType.BOOKING_CANCELLED,
                title: "Session cancelled",
                body: `${cancelledByLabel} cancelled the session on ${whenLabel}.`,
                link: "/sessions",
                relatedId: booking._id,
                email: mentorUser.email
                    ? {
                          to: mentorUser.email,
                          ...bookingCancelledTemplate(mentorUser.name, fellowDoc?.name ?? "a fellow", whenLabel, cancelledByLabel, appUrl),
                      }
                    : undefined,
            });
        } else if (!cancelledByFellow && fellowDoc?.authId) {
            // Notify the fellow.
            await createNotification({
                recipient: fellowDoc.authId,
                type: NotificationType.BOOKING_CANCELLED,
                title: "Session cancelled",
                body: `${cancelledByLabel} cancelled the session on ${whenLabel}.`,
                link: "/sessions",
                relatedId: booking._id,
                email: fellowDoc.email
                    ? {
                          to: fellowDoc.email,
                          ...bookingCancelledTemplate(fellowDoc.name, mentorUser?.name ?? "your mentor", whenLabel, cancelledByLabel, appUrl),
                      }
                    : undefined,
            });
        }

        void logActivity({
            session,
            action: "CANCEL_BOOKING",
            targetType: "Booking",
            targetId: String(booking._id),
        });

        return jsonOk({ success: true, status: booking.status });
    },
);
