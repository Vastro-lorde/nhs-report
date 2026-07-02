/**
 * @openapi
 * /api/auth/set-password:
 *   get:
 *     tags: [Auth]
 *     summary: Validate a fellow invite / set-password token
 *     description: >
 *       Checks whether a set-password token is valid and unexpired. Public
 *       endpoint used by the set-password page to decide whether to render the
 *       form. Never reveals user details.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Token validity.
 *         content:
 *           application/json:
 *             example: { valid: true, name: "Ada Obi", email: "fellow@example.com" }
 *       400: { description: Missing token }
 *   post:
 *     tags: [Auth]
 *     summary: Set password from an invite token
 *     description: >
 *       Consumes a valid set-password token, stores the bcrypt-hashed password,
 *       activates the user, marks the linked fellow as active, and clears the
 *       token. Public endpoint (no session required).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8, maxLength: 128 }
 *           example: { token: "a1b2c3…", password: "S3curePass!" }
 *     responses:
 *       200:
 *         description: Password set and account activated.
 *         content:
 *           application/json:
 *             example: { success: true, email: "fellow@example.com" }
 *       400: { description: Missing/weak password or missing token }
 *       401: { description: Invalid or expired token }
 *       500: { description: Server error }
 */
import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { User, Fellow } from "@/models";
import { FellowInviteStatus } from "@/lib/constants";

const MIN_PASSWORD_LENGTH = 8;

function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

export const GET = withExceptionLog(
    "GET /api/auth/set-password",
    async (request: NextRequest) => {
        const token = new URL(request.url).searchParams.get("token")?.trim();
        if (!token) return jsonError("Token is required", 400);

        await connectDB();
        const tokenHash = hashToken(token);
        const user = await User.findOne({
            inviteTokenHash: tokenHash,
            inviteTokenExpires: { $gt: new Date() },
        })
            .select("name email")
            .lean();

        if (!user) return jsonOk({ valid: false });
        return jsonOk({ valid: true, name: user.name, email: user.email });
    },
);

export const POST = withExceptionLog(
    "POST /api/auth/set-password",
    async (request: NextRequest) => {
        const body = await parseBody<{ token?: string; password?: string }>(request);
        const token = body?.token?.trim();
        const password = body?.password;

        if (!token) return jsonError("Token is required", 400);
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return jsonError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
        }

        await connectDB();
        const tokenHash = hashToken(token);
        const user = await User.findOne({
            inviteTokenHash: tokenHash,
            inviteTokenExpires: { $gt: new Date() },
        }).select("+inviteTokenHash +inviteTokenExpires");

        if (!user) return jsonError("Invalid or expired invitation link", 401);

        user.password = await bcrypt.hash(password, 12);
        user.active = true;
        user.inviteTokenHash = undefined;
        user.inviteTokenExpires = undefined;
        await user.save();

        await Fellow.updateOne(
            { authId: user._id },
            { $set: { inviteStatus: FellowInviteStatus.ACTIVE } },
        );

        return jsonOk({ success: true, email: user.email });
    },
);
