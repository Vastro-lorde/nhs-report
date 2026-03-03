/* ──────────────────────────────────────────
   API: /api/coordinators — CRUD for coordinators
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { newCoordinatorEmailTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";

// GET /api/coordinators — list coordinators (admin only)
export async function GET(request: NextRequest) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    await connectDB();

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const filter: Record<string, unknown> = { role: UserRole.COORDINATOR };
    const search = url.searchParams.get("search");

    // Coordinator-specific filters
    const coordinatorFilter: Record<string, unknown> = {};
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

    // 2. Find matching coordinator details linked to these users
    coordinatorFilter.authId = { $in: userIds };
    const coordinatorDetailsList = await Coordinator.find(coordinatorFilter).lean();

    // Combine user info with coordinator info
    const finalUsers = users.map(u => {
        const cd = coordinatorDetailsList.find(c => c.authId.toString() === u._id.toString());
        return {
            ...u,
            states: cd?.states || [],
            coordinatorId: cd?._id,
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

// POST /api/coordinators — create a coordinator (admin only)
interface CreateCoordinatorBody {
    name: string;
    email: string;
    password: string;
    phone?: string;
    states?: string[];
}

export async function POST(request: NextRequest) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const body = await parseBody<CreateCoordinatorBody>(request);
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
        role: UserRole.COORDINATOR,
        active: true,
    });

    const coordinatorDoc = await Coordinator.create({
        authId: user._id,
        states: body.states ? body.states.map((st: string) => st.toUpperCase().trim()) : []
    });

    const { password: _, ...userData } = user.toObject();
    (userData as any).states = coordinatorDoc.states;

    // Send email invitation
    try {
        const emailContent = newCoordinatorEmailTemplate(
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
        console.error("Failed to send coordinator invitation email:", emailErr);
        // We still return success since the user was created, but maybe add a warning note.
    }

    return jsonCreated(userData);
}
