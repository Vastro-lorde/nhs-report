/**
 * @openapi
 * /api/mentors/{id}/meet-stats:
 *   get:
 *     tags: [Mentors, Google Meet]
 *     summary: Get a mentor's Google Meet statistics
 *     description: >
 *       Returns past meeting statistics for the mentor's Meet space — number of
 *       meetings, total duration, participant counts, and links to recordings and
 *       transcripts (which the mentor started manually in-meeting). Admin only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Meeting statistics summary.
 *         content:
 *           application/json:
 *             example:
 *               connected: true
 *               email: "mentor@example.com"
 *               summary: { totalMeetings: 3, totalMinutes: 95, totalRecordings: 2, totalTranscripts: 1, meetings: [] }
 *       400: { description: Mentor has not connected Google or has no space yet }
 *       401: { description: Not authenticated }
 *       403: { description: Not an admin }
 *       404: { description: Mentor not found }
 *       502: { description: Google API error }
 *       503: { description: Google integration not configured }
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { env } from "@/lib/env";
import { getAccessToken, getMeetStats } from "@/lib/google-meet";

type Params = { params: Promise<{ id: string }> };

export const GET = withExceptionLog(
    "GET /api/mentors/[id]/meet-stats",
    async (_request: NextRequest, { params }: Params) => {
        const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
        if (error) return error;

        if (!env.GOOGLE_ENABLED()) return jsonError("Google integration is not configured", 503);

        const { id } = await params;
        await connectDB();

        const mentor = await Mentor.findOne({ authId: id }).select("+google.refreshToken");
        if (!mentor) return jsonError("Mentor not found", 404);

        if (session!.user.role === UserRole.COORDINATOR) {
            const coordinator = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (!coordinator) return jsonError("Coordinator record not found", 404);
            if (mentor.coordinator.toString() !== coordinator._id.toString()) {
                return jsonError("Mentor not found", 404);
            }
        }

        if (!mentor.google?.refreshToken) {
            return jsonOk({ connected: false, email: null, meetingLink: mentor.meetingLink ?? null, summary: null });
        }
        if (!mentor.google.spaceName) {
            return jsonOk({
                connected: true,
                email: mentor.google.email ?? null,
                meetingLink: mentor.meetingLink ?? null,
                summary: { totalMeetings: 0, totalMinutes: 0, totalRecordings: 0, totalTranscripts: 0, meetings: [] },
            });
        }

        try {
            const accessToken = await getAccessToken(mentor.google.refreshToken);
            const summary = await getMeetStats(accessToken, mentor.google.spaceName);
            return jsonOk({ connected: true, email: mentor.google.email ?? null, meetingLink: mentor.meetingLink ?? null, summary });
        } catch (err) {
            console.error("[meet-stats] Google API error:", err);
            return jsonError("Could not fetch Meet statistics. The mentor may need to reconnect Google.", 502);
        }
    },
);
