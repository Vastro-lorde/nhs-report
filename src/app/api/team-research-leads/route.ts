/* ──────────────────────────────────────────
   API: /api/team-research-leads — CRUD for Team Research Leads
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, TeamResearchLead } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { newTeamResearchLeadEmailTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity-logger";

// GET /api/team-research-leads — list Team Research Leads (admin only)
export async function GET(request: NextRequest) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    await connectDB();

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const filter: Record<string, unknown> = { role: UserRole.TEAM_RESEARCH_LEAD };
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

    // Find matching Team Research Lead details linked to these users
    const teamResearchLeadDetailsList = await TeamResearchLead.find({ authId: { $in: userIds } }).lean();

    // Combine user info with Team Research Lead info
    const finalUsers = users.map(u => {
        const md = teamResearchLeadDetailsList.find(m => m.authId.toString() === u._id.toString());
        return {
            ...u,
            teamResearchLeadId: md?._id,
        };
    });

    const total = finalUsers.length;
    const paginatedUsers = finalUsers.slice(skip, skip + limit);

    return jsonOk({
        data: paginatedUsers,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
}

// POST /api/team-research-leads — create a Team Research Lead (admin only)
interface CreateTeamResearchLeadBody {
    name: string;
    email: string;
    password: string;
    phone?: string;
}

export async function POST(request: NextRequest) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const body = await parseBody<CreateTeamResearchLeadBody>(request);
    if (!body || !body.name || !body.email || !body.password) {
        return jsonError("Name, email, and password are required");
    }

    await connectDB();

    const existing = await User.findOne({ email: body.email.toLowerCase().trim() });
    if (existing) return jsonError("A user with this email already exists", 409);

    const hashedPassword = await bcrypt.hash(body.password, 12);

    const user = await User.create({
        name: body.name.trim(),
        email: body.email.toLowerCase().trim(),
        password: hashedPassword,
        phone: body.phone?.trim(),
        role: UserRole.TEAM_RESEARCH_LEAD,
        active: true,
    });

    await TeamResearchLead.create({
        authId: user._id,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userData } = user.toObject();

    // Send email invitation
    try {
        const emailContent = newTeamResearchLeadEmailTemplate(
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
        console.error("Failed to send Team Research Lead invitation email:", emailErr);
    }

    void logActivity({ session, action: "CREATE_TEAM_RESEARCH_LEAD", targetType: "TeamResearchLead", targetId: String(user._id), targetName: user.name });
    return jsonCreated(userData);
}
