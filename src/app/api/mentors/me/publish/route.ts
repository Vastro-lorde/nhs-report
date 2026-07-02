/**
 * @openapi
 * /api/mentors/me/publish:
 *   post:
 *     tags: [Mentors, Scheduling, Notifications]
 *     summary: Notify fellows of available session slots
 *     description: >
 *       Sends a portal notification and email to every active fellow assigned to
 *       the current mentor, letting them know new session times are open for
 *       booking. Only fellows with activated accounts are notified. Mentor role
 *       only. Returns the number of fellows notified.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Fellows notified.
 *         content:
 *           application/json:
 *             example: { success: true, notified: 12, openSlots: 8 }
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 */
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor, Fellow, User, TimeSlot } from "@/models";
import { UserRole, FellowInviteStatus, NotificationType, TimeSlotStatus } from "@/lib/constants";
import { createNotifications, type CreateNotificationInput } from "@/lib/notify";
import { slotsPublishedTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity-logger";

export const POST = withExceptionLog("POST /api/mentors/me/publish", async () => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    await connectDB();
    const mentor = await Mentor.findOne({ authId: session!.user.id }).lean();
    if (!mentor) return jsonError("Mentor profile not found", 404);

    const openSlots = await TimeSlot.countDocuments({
        mentor: mentor._id,
        status: TimeSlotStatus.OPEN,
        startAt: { $gte: new Date() },
    });

    const mentorUser = await User.findById(mentor.authId).select("name").lean();
    const mentorName = mentorUser?.name ?? "Your mentor";

    const fellows = await Fellow.find({
        mentor: mentor._id,
        inviteStatus: FellowInviteStatus.ACTIVE,
        authId: { $ne: null },
    })
        .select("name email authId")
        .lean();

    const appUrl = env.NEXTAUTH_URL();
    const inputs: CreateNotificationInput[] = fellows
        .filter((f) => f.authId)
        .map((f) => {
            const email = f.email
                ? { to: f.email, ...slotsPublishedTemplate(f.name, mentorName, appUrl) }
                : undefined;
            return {
                recipient: f.authId!,
                type: NotificationType.SLOTS_PUBLISHED,
                title: "New session times available",
                body: `${mentorName} has opened new session slots. Book a session.`,
                link: "/book",
                relatedId: mentor._id,
                email,
            };
        });

    await createNotifications(inputs);

    void logActivity({
        session,
        action: "PUBLISH_AVAILABILITY",
        targetType: "Mentor",
        targetId: String(mentor._id),
    });

    return jsonOk({ success: true, notified: inputs.length, openSlots });
});
