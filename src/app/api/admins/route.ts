/* ──────────────────────────────────────────
   API: /api/admins
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
    try {
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const search = searchParams.get("search") || "";
        const skip = (page - 1) * limit;

        const query: any = { role: UserRole.ADMIN };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const [admins, total] = await Promise.all([
            User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query),
        ]);

        return jsonOk({
            data: admins,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const body = await request.json();
        const { name, email, password, phone } = body;

        if (!name || !email || !password) {
            return jsonError("Missing required fields", 400);
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return jsonError("Email already in use", 400);
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Explicitly set rootAdmin: false to prevent privilege escalation via POST
        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone,
            role: UserRole.ADMIN,
            rootAdmin: false,
            active: true,
        });

        const safeUser = newUser.toObject();
        delete (safeUser as any).password;

        return jsonOk(safeUser, 201);
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}
