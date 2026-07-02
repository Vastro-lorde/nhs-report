/**
 * @openapi
 * /api/fellows/{id}/invite:
 *   post:
 *     tags: [Fellows]
 *     summary: Invite a fellow to the portal
 *     description: >
 *       Sends a portal invitation to an existing fellow. The mentor supplies the
 *       fellow's email; the email is written onto the fellow record, a linked
 *       auth user (role `fellow`, inactive until password set) is created, and a
 *       secure set-password link is emailed. Only the mentor who owns the fellow
 *       (or an admin) may invite. The fellow must not already be active.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Fellow document id.
 *         schema: { type: string, example: "665f1c2e9b1e2a0012a34567" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, maxLength: 254 }
 *           example: { email: "fellow@example.com" }
 *     responses:
 *       200:
 *         description: Invitation sent.
 *         content:
 *           application/json:
 *             example: { success: true, message: "Invitation sent", fellowId: "665f1c2e9b1e2a0012a34567" }
 *       400: { description: Validation error (missing/invalid email) }
 *       401: { description: Not authenticated }
 *       403: { description: Not the owning mentor / not permitted }
 *       404: { description: Fellow not found }
 *       409: { description: Fellow already active, or email already used by another account }
 *       500: { description: Server error }
 */
import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { Fellow, Mentor, User } from "@/models";
import { UserRole, FellowInviteStatus, NotificationType } from "@/lib/constants";
import { fellowInviteTemplate } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity-logger";

const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Params = { params: Promise<{ id: string }> };

export const POST = withExceptionLog(
    "POST /api/fellows/[id]/invite",
    async (request: NextRequest, { params }: Params) => {
        const { session, error } = await requireRole(UserRole.MENTOR, UserRole.ADMIN);
        if (error) return error;

        const { id } = await params;
        const body = await parseBody<{ email?: string; phone?: string }>(request);
        const email = body?.email?.toLowerCase().trim();
        const phone = body?.phone?.trim();
        if (!email || !EMAIL_RE.test(email)) {
            return jsonError("A valid email is required", 400);
        }

        await connectDB();

        const fellow = await Fellow.findById(id);
        if (!fellow) return jsonError("Fellow not found", 404);

        // Ownership check for mentors.
        let mentorDoc = null;
        if (session!.user.role === UserRole.MENTOR) {
            mentorDoc = await Mentor.findOne({ authId: session!.user.id }).lean();
            if (!mentorDoc || String(fellow.mentor) !== String(mentorDoc._id)) {
                return jsonError("Forbidden — this fellow is not assigned to you", 403);
            }
        } else {
            mentorDoc = await Mentor.findById(fellow.mentor).lean();
        }

        if (fellow.inviteStatus === FellowInviteStatus.ACTIVE) {
            return jsonError("This fellow already has an active account", 409);
        }

        // Ensure the email is not already used by another auth user (unless it's
        // the user already linked to this fellow).
        const existingUser = await User.findOne({ email }).select("+inviteTokenHash");
        if (existingUser && String(existingUser._id) !== String(fellow.authId ?? "")) {
            return jsonError("Email already used by another account", 409);
        }

        // Generate a secure invite token (store only its hash).
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expires = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

        let userDoc = existingUser;
        if (userDoc) {
            userDoc.name = userDoc.name || fellow.name;
            userDoc.role = UserRole.FELLOW;
            userDoc.active = false;
            if (phone) userDoc.phone = phone;
            userDoc.inviteTokenHash = tokenHash;
            userDoc.inviteTokenExpires = expires;
            await userDoc.save();
        } else {
            // Inactive placeholder password until the fellow sets their own.
            const placeholder = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12);
            userDoc = await User.create({
                name: fellow.name,
                email,
                password: placeholder,
                role: UserRole.FELLOW,
                active: false,
                ...(phone ? { phone } : {}),
                inviteTokenHash: tokenHash,
                inviteTokenExpires: expires,
            });
        }

        fellow.email = email;
        fellow.authId = userDoc._id;
        fellow.inviteStatus = FellowInviteStatus.INVITED;
        fellow.invitedAt = new Date();
        await fellow.save();

        const mentorName = mentorDoc
            ? (await User.findById(mentorDoc.authId).select("name").lean())?.name ?? "your mentor"
            : "your mentor";

        const { subject, text, html } = fellowInviteTemplate(
            fellow.name,
            mentorName,
            rawToken,
            env.NEXTAUTH_URL(),
        );
        try {
            await sendMail({ to: email, subject, text, html });
        } catch (err) {
            console.error("[fellow-invite] Failed to send invite email:", err);
            return jsonError("Could not send the invitation email. Please try again.", 500);
        }

        void logActivity({
            session,
            action: "INVITE_FELLOW",
            targetType: "Fellow",
            targetId: String(fellow._id),
            targetName: fellow.name,
        });

        return jsonOk({
            success: true,
            message: "Invitation sent",
            fellowId: String(fellow._id),
            type: NotificationType.FELLOW_INVITED,
        });
    },
);
