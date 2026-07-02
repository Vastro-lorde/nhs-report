/**
 * @openapi
 * /api/fellows/me/slots:
 *   get:
 *     tags: [Fellows, Scheduling]
 *     summary: List bookable slots for the fellow's mentor
 *     description: >
 *       Returns the current fellow's mentor's upcoming OPEN time slots, each with
 *       a resolved meeting link (per-slot override falling back to the mentor's
 *       default). Fellow role only.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Open slots plus mentor context.
 *         content:
 *           application/json:
 *             example:
 *               mentorName: "Dr. Ada Obi"
 *               slots: [{ _id: "s1", startAt: "2026-07-06T09:00:00.000Z", endAt: "2026-07-06T09:40:00.000Z", meetingLink: "https://meet.example.com/ada" }]
 *       401: { description: Not authenticated }
 *       403: { description: Not a fellow }
 *       404: { description: Fellow profile not found }
 */
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Fellow, Mentor, User, TimeSlot } from "@/models";
import { UserRole, TimeSlotStatus } from "@/lib/constants";

export const GET = withExceptionLog("GET /api/fellows/me/slots", async () => {
    const { session, error } = await requireRole(UserRole.FELLOW);
    if (error) return error;

    await connectDB();
    const fellow = await Fellow.findOne({ authId: session!.user.id }).select("mentor").lean();
    if (!fellow) return jsonError("Fellow profile not found", 404);

    const mentor = await Mentor.findById(fellow.mentor).select("meetingLink authId").lean();
    if (!mentor) return jsonError("Mentor not found", 404);

    const mentorUser = await User.findById(mentor.authId).select("name").lean();

    const slots = await TimeSlot.find({
        mentor: fellow.mentor,
        status: TimeSlotStatus.OPEN,
        startAt: { $gte: new Date() },
    })
        .sort({ startAt: 1 })
        .lean();

    const withLinks = slots.map((s) => ({
        ...s,
        meetingLink: s.meetingLinkOverride || mentor.meetingLink || null,
    }));

    return jsonOk({ mentorName: mentorUser?.name ?? "Your mentor", slots: withLinks });
});
