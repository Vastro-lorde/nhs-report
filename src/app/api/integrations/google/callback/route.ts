/**
 * @openapi
 * /api/integrations/google/callback:
 *   get:
 *     tags: [Integrations, Google Meet]
 *     summary: Google OAuth callback
 *     description: >
 *       Handles the Google OAuth redirect. Exchanges the code for tokens, stores
 *       the mentor's refresh token and connected email, then redirects back to
 *       the schedule page. The `state` carries the mentor id and must match the
 *       logged-in mentor. Mentor role only.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: error
 *         schema: { type: string }
 *     responses:
 *       302: { description: Redirect back to the schedule page }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { env } from "@/lib/env";
import { exchangeCode, getUserEmail } from "@/lib/google-meet";
import { logActivity } from "@/lib/activity-logger";

function redirectTo(status: string): NextResponse {
    const url = `${env.NEXTAUTH_URL().replace(/\/$/, "")}/schedule?google=${status}`;
    return NextResponse.redirect(url);
}

export const GET = withExceptionLog(
    "GET /api/integrations/google/callback",
    async (request: NextRequest) => {
        const { session, error } = await requireRole(UserRole.MENTOR);
        // On auth failure send the browser to login rather than a JSON error.
        if (error) return redirectTo("error");

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError || !code || !state) return redirectTo("denied");

        await connectDB();
        const mentor = await Mentor.findOne({ authId: session!.user.id }).select("+google.refreshToken");
        if (!mentor || String(mentor._id) !== state) {
            return redirectTo("mismatch");
        }

        const tokens = await exchangeCode(code);
        if (!tokens.refresh_token) {
            // No refresh token returned (already granted without prompt=consent).
            return redirectTo("no_refresh");
        }

        const email = await getUserEmail(tokens.access_token);

        mentor.google = {
            ...(mentor.google ?? {}),
            email,
            refreshToken: tokens.refresh_token,
            connectedAt: new Date(),
        };
        await mentor.save();

        void logActivity({
            session,
            action: "CONNECT_GOOGLE",
            targetType: "Mentor",
            targetId: String(mentor._id),
        });

        return redirectTo("connected");
    },
);
