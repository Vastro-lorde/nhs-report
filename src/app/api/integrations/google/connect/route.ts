/**
 * @openapi
 * /api/integrations/google/connect:
 *   get:
 *     tags: [Integrations, Google Meet]
 *     summary: Start Google Meet account connection
 *     description: >
 *       Returns a Google OAuth consent URL for the current mentor to connect
 *       their Google account. The resulting refresh token lets the platform
 *       generate a reusable Meet space owned by the mentor. Mentor role only.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Consent URL.
 *         content:
 *           application/json:
 *             example: { url: "https://accounts.google.com/o/oauth2/auth?..." }
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 *       503: { description: Google integration not configured }
 */
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { env } from "@/lib/env";
import { buildAuthUrl } from "@/lib/google-meet";

export const GET = withExceptionLog("GET /api/integrations/google/connect", async () => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    if (!env.GOOGLE_ENABLED()) {
        return jsonError("Google integration is not configured", 503);
    }

    await connectDB();
    const mentor = await Mentor.findOne({ authId: session!.user.id }).select("_id").lean();
    if (!mentor) return jsonError("Mentor profile not found", 404);

    const url = buildAuthUrl(String(mentor._id));
    return jsonOk({ url });
});
