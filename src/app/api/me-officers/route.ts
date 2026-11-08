/* ──────────────────────────────────────────
   API: /api/me-officers — CRUD for M&E Officers
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, MEOfficer } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { newMEOfficerEmailTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity-logger";
import { checkEmailForNewMember, memberUserIds, reuseUserForMembership } from "@/services/cohort.service";

// GET /api/me-officers — list M&E officers (admin only)
export async function GET(request: NextRequest) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    await connectDB();

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    // Members of the cohort being viewed (not User.role: people who left, or
    // were promoted since, must still list correctly in earlier cohorts).
    const filter: Record<string, unknown> = { _id: { $in: await memberUserIds("me_officer") } };
    const search = url.searchParams.get("search");

    const active = url.searchParams.get("active");
    if (active !== null) filter.active = active === "true";

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    const users = await User.find(filter).select("-password").sort({ name: 1 }).lean();

    const userIds = users.map(u => u._id);

    // Find matching ME officer details linked to these users
    const meOfficerDetailsList = await MEOfficer.find({ authId: { $in: userIds } }).lean();

    // Combine user info with ME officer info
    const finalUsers = users.map(u => {
        const md = meOfficerDetailsList.find(m => m.authId.toString() === u._id.toString());
        return {
            ...u,
            meOfficerId: md?._id,
        };
    });

    const total = finalUsers.length;
    const paginatedUsers = finalUsers.slice(skip, skip + limit);

    return jsonOk({
        data: paginatedUsers,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
}

// POST /api/me-officers — create an M&E officer (admin only)
interface CreateMEOfficerBody {
    name: string;
    email: string;
    password: string;
    phone?: string;
}

export async function POST(request: NextRequest) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const body = await parseBody<CreateMEOfficerBody>(request);
    if (!body || !body.name || !body.email || !body.password) {
        return jsonError("Name, email, and password are required");
    }

    await connectDB();

    // A returning person from an earlier cohort is re-attached to their existing
    // login (password unchanged); anyone already in this cohort is refused.
    const emailCheck = await checkEmailForNewMember(body.email);
    if (!emailCheck.ok) return jsonError(emailCheck.error, emailCheck.status);
    const isReturning = Boolean(emailCheck.existingUser);

    const user = emailCheck.existingUser
        ? await reuseUserForMembership(emailCheck.existingUser, "me_officer", emailCheck.scope, { name: body.name, phone: body.phone })
        : await User.create({
            name: body.name.trim(),
            email: body.email.toLowerCase().trim(),
            password: await bcrypt.hash(body.password, 12),
            phone: body.phone?.trim(),
            role: UserRole.ME_OFFICER,
            active: true,
        });

    await MEOfficer.create({
        authId: user._id,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userData } = user.toObject();

    // Send email invitation — not to returning people, whose password is unchanged.
    if (!isReturning) try {
        const emailContent = newMEOfficerEmailTemplate(
            user.name,
            user.email,
            body.password,
            env.NEXTAUTH_URL()
        );
        await sendMail({
            to: user.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
        });
    } catch (emailErr) {
        console.error("Failed to send M&E officer invitation email:", emailErr);
    }

    void logActivity({ session, action: "CREATE_ME_OFFICER", targetType: "MEOfficer", targetId: String(user._id), targetName: user.name });
    return jsonCreated(userData);
}
