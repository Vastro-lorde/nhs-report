/**
 * @openapi
 * /api/mentors/{id}/meet-link:
 *   post:
 *     tags: [Mentors, Google Meet]
 *     summary: Generate a persistent Google Meet link for a mentor
 *     description: >
 *       Creates a reusable Google Meet space owned by the mentor's connected
 *       Google account and sets it as the mentor's meeting link (the same field
 *       the mentor can edit). The mentor must have connected their Google account
 *       first. Admin only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Link generated and saved.
 *         content:
 *           application/json:
 *             example: { meetingLink: "https://meet.google.com/abc-defg-hij", spaceName: "spaces/abc", meetingCode: "abc-defg-hij" }
 *       400: { description: Mentor has not connected Google }
 *       401: { description: Not authenticated }
 *       403: { description: Not an admin }
 *       404: { description: Mentor not found }
 *       502: { description: Google API error (token revoked / expired) }
 *       503: { description: Google integration not configured }
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { env } from "@/lib/env";
import { getAccessToken, createMeetSpace } from "@/lib/google-meet";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export const POST = withExceptionLog(
    "POST /api/mentors/[id]/meet-link",
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
            return jsonError("This mentor has not connected their Google account yet", 400);
        }

        let meetingUri: string;
        let spaceName: string;
        let meetingCode: string;
        try {
            const accessToken = await getAccessToken(mentor.google.refreshToken);
            const space = await createMeetSpace(accessToken);
            meetingUri = space.meetingUri;
            spaceName = space.name;
            meetingCode = space.meetingCode;
        } catch (err) {
            console.error("[meet-link] Google API error:", err);
            return jsonError(
                "Could not generate a Meet link. The mentor may need to reconnect their Google account.",
                502,
            );
        }

        mentor.meetingLink = meetingUri;
        mentor.google = {
            ...(mentor.google ?? {}),
            spaceName,
            meetingCode,
            meetingUri,
        };
        await mentor.save();

        void logActivity({
            session,
            action: "GENERATE_MEET_LINK",
            targetType: "Mentor",
            targetId: String(mentor._id),
        });

        return jsonOk({ meetingLink: meetingUri, spaceName, meetingCode });
    },
);
