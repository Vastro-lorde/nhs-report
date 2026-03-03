/* ──────────────────────────────────────────
   API: /api/desk-officers — CRUD for desk officers
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, DeskOfficer } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { newDeskOfficerEmailTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";

// GET /api/desk-officers — list desk officers (admin only)
export async function GET(request: NextRequest) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    await connectDB();

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const filter: Record<string, unknown> = { role: UserRole.ZONAL_DESK_OFFICER };
    const search = url.searchParams.get("search");

    // DeskOfficer-specific filters
    const deskOfficerFilter: Record<string, unknown> = {};
    const active = url.searchParams.get("active");
    if (active !== null) filter.active = active === "true";

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    // 1. Find matching users first
    const users = await User.find(filter).select("-password").sort({ name: 1 }).lean();
    let userIds = users.map(u => u._id);

    // 2. Find matching desk officer details linked to these users
    deskOfficerFilter.authId = { $in: userIds };
    const deskOfficerDetailsList = await DeskOfficer.find(deskOfficerFilter).lean();

    // Combine user info with desk officer info
    const finalUsers = users.map(u => {
        const cd = deskOfficerDetailsList.find(c => c.authId.toString() === u._id.toString());
        return {
            ...u,
            states: cd?.states || [],
            deskOfficerId: cd?._id,
        };
    });

    const total = finalUsers.length;
    // Apply pagination
    const paginatedUsers = finalUsers.slice(skip, skip + limit);

    return jsonOk({
        data: paginatedUsers,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
}

// POST /api/desk-officers — create a desk officer (admin only)
interface CreateDeskOfficerBody {
    name: string;
    email: string;
    password: string;
    phone?: string;
    states?: string[];
}

export async function POST(request: NextRequest) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const body = await parseBody<CreateDeskOfficerBody>(request);
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
        role: UserRole.ZONAL_DESK_OFFICER,
        active: true,
    });

    const deskOfficerDoc = await DeskOfficer.create({
        authId: user._id,
        states: body.states ? body.states.map((st: string) => st.toUpperCase().trim()) : []
    });

    const { password: _, ...userData } = user.toObject();
    (userData as any).states = deskOfficerDoc.states;

    // Send email invitation
    try {
        const emailContent = newDeskOfficerEmailTemplate(
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
        console.error("Failed to send desk officer invitation email:", emailErr);
    }

    return jsonCreated(userData);
}
