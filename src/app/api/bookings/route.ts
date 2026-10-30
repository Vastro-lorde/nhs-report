/**
 * @openapi
 * /api/bookings:
 *   get:
 *     tags: [Bookings, Scheduling]
 *     summary: List bookings
 *     description: >
 *       Role-scoped booking list. Fellows see their own bookings; mentors see
 *       bookings made with them; admins see all. Most recent sessions first.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [confirmed, cancelled, completed, no_show] }
 *       - in: query
 *         name: upcoming
 *         description: When "true", only future sessions are returned.
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated bookings }
 *       401: { description: Not authenticated }
 *       403: { description: Role not permitted }
 *   post:
 *     tags: [Bookings, Scheduling]
 *     summary: Book a session slot
 *     description: >
 *       Books one of the fellow's mentor's OPEN slots with an optional note.
 *       The slot is atomically flipped to booked to prevent double-booking, and
 *       the booking is auto-confirmed. The mentor is notified (portal + email)
 *       and the fellow receives a confirmation. Fellow role only.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slotId]
 *             properties:
 *               slotId: { type: string }
 *               note: { type: string, maxLength: 1000 }
 *           example: { slotId: "665f…", note: "Would love to discuss my research proposal." }
 *     responses:
 *       201: { description: Booking confirmed }
 *       400: { description: Missing slotId }
 *       401: { description: Not authenticated }
 *       403: { description: Not a fellow / slot belongs to another mentor }
 *       404: { description: Fellow profile or slot not found }
 *       409: { description: Slot no longer available }
 */
import { NextRequest } from "next/server";
import { requireRole, requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Fellow, Mentor, User, TimeSlot, Booking } from "@/models";
import { UserRole, TimeSlotStatus, BookingStatus, NotificationType } from "@/lib/constants";
import { createNotification } from "@/lib/notify";
import { formatSlotLabel } from "@/lib/schedule-helpers";
import {
    bookingConfirmedFellowTemplate,
    bookingConfirmedMentorTemplate,
} from "@/lib/email-templates";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity-logger";

export const GET = withExceptionLog("GET /api/bookings", async (request: NextRequest) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    const role = session!.user.role;
    if (![UserRole.FELLOW, UserRole.MENTOR, UserRole.ADMIN].includes(role as never)) {
        return jsonError("Forbidden", 403);
    }

    await connectDB();
    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const filter: Record<string, unknown> = {};
    const statusParam = url.searchParams.get("status");
    if (statusParam) filter.status = statusParam;
    if (url.searchParams.get("upcoming") === "true") filter.endAt = { $gte: new Date() };

    if (role === UserRole.FELLOW) {
        const fellow = await Fellow.findOne({ authId: session!.user.id }).select("_id").lean();
        if (!fellow) return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        filter.fellow = fellow._id;
    } else if (role === UserRole.MENTOR) {
        const mentor = await Mentor.findOne({ authId: session!.user.id }).select("_id").lean();
        if (!mentor) return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        filter.mentor = mentor._id;
    }

    const [data, total] = await Promise.all([
        Booking.find(filter)
            .sort({ startAt: 1 })
            .skip(skip)
            .limit(limit)
            .populate("fellow", "name email")
            .lean(),
        Booking.countDocuments(filter),
    ]);

    return jsonOk({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
});

export const POST = withExceptionLog("POST /api/bookings", async (request: NextRequest) => {
    const { session, error } = await requireRole(UserRole.FELLOW);
    if (error) return error;

    const body = await parseBody<{ slotId?: string; note?: string }>(request);
    if (!body?.slotId) return jsonError("slotId is required", 400);

    await connectDB();
    const fellow = await Fellow.findOne({ authId: session!.user.id }).lean();
    if (!fellow) return jsonError("Fellow profile not found", 404);

    const mentor = await Mentor.findById(fellow.mentor).select("meetingLink authId").lean();
    if (!mentor) return jsonError("Mentor not found", 404);

    // Atomically claim the slot: only an OPEN, future slot belonging to this
    // fellow's mentor can be booked. This prevents concurrent double-booking.
    const slot = await TimeSlot.findOneAndUpdate(
        {
            _id: body.slotId,
            mentor: fellow.mentor,
            status: TimeSlotStatus.OPEN,
            startAt: { $gte: new Date() },
        },
        { $set: { status: TimeSlotStatus.BOOKED } },
        { new: true },
    );
    if (!slot) return jsonError("This slot is no longer available", 409);

    const meetingLink = slot.meetingLinkOverride || mentor.meetingLink || undefined;

    let booking;
    try {
        booking = await Booking.create({
            timeSlot: slot._id,
            fellow: fellow._id,
            mentor: fellow.mentor,
            note: body.note?.trim() || undefined,
            status: BookingStatus.CONFIRMED,
            meetingLink,
            startAt: slot.startAt,
            endAt: slot.endAt,
        });
    } catch (err) {
        // Roll back the slot claim if the booking could not be created.
        await TimeSlot.updateOne({ _id: slot._id }, { $set: { status: TimeSlotStatus.OPEN } });
        throw err;
    }

    const appUrl = env.NEXTAUTH_URL();
    const whenLabel = formatSlotLabel(slot.startAt, slot.endAt);
    const mentorUser = await User.findById(mentor.authId).select("name email").lean();
    const mentorName = mentorUser?.name ?? "your mentor";

    // Notify the mentor (portal + email).
    await createNotification({
        recipient: mentor.authId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: "New session booked",
        body: `${fellow.name} booked a session for ${whenLabel}.`,
        link: "/sessions",
        relatedId: booking._id,
        email: mentorUser?.email
            ? {
                  to: mentorUser.email,
                  ...bookingConfirmedMentorTemplate(mentorName, fellow.name, whenLabel, body.note?.trim(), appUrl),
              }
            : undefined,
    });

    // Confirm to the fellow (portal + email).
    await createNotification({
        recipient: session!.user.id,
        type: NotificationType.BOOKING_CONFIRMED,
        title: "Session confirmed",
        body: `Your session with ${mentorName} is confirmed for ${whenLabel}.`,
        link: "/sessions",
        relatedId: booking._id,
        email: fellow.email
            ? {
                  to: fellow.email,
                  ...bookingConfirmedFellowTemplate(fellow.name, mentorName, whenLabel, meetingLink, appUrl),
              }
            : undefined,
    });

    void logActivity({
        session,
        action: "CREATE_BOOKING",
        targetType: "Booking",
        targetId: String(booking._id),
        targetName: fellow.name,
    });

    return jsonCreated(booking);
});
