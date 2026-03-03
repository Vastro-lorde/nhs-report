/* ──────────────────────────────────────────
   API: /api/desk-officers/[id]/reset-password — Admin reset desk officer password
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    const body = await parseBody<{ password?: string }>(request);

    if (!body || !body.password) {
        return jsonError("New password is required");
    }

    if (body.password.length < 6) {
        return jsonError("Password must be at least 6 characters long");
    }

    await connectDB();
    const hashedPassword = await bcrypt.hash(body.password, 12);

    const deskOfficer = await User.findByIdAndUpdate(id, { password: hashedPassword })
        .select("-password")
        .lean();

    if (!deskOfficer) return jsonError("Desk Officer not found", 404);

    return jsonOk({ success: true, message: "Password reset successfully" });
}
