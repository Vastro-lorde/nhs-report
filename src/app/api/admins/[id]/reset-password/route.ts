/* ──────────────────────────────────────────
   API: /api/admins/[id]/reset-password
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(
    request: NextRequest,
    { params }: Params
) {
    try {
        const session = await auth();
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const body = await request.json();
        if (!body.password || body.password.length < 6) {
            return jsonError("Password must be at least 6 characters long", 400);
        }

        const { id } = await params;
        const targetAdmin = await User.findOne({ _id: id, role: UserRole.ADMIN });
        if (!targetAdmin) return jsonError("Admin not found", 404);

        // Prevent non-root admins from resetting root admin passwords
        if (targetAdmin.rootAdmin && !session?.user.rootAdmin) {
            return jsonError("Forbidden: Cannot reset password of a root administrator", 403);
        }

        const hashedPassword = await bcrypt.hash(body.password, 12);
        targetAdmin.password = hashedPassword;
        await targetAdmin.save();

        return jsonOk({ success: true, message: "Password reset correctly" });
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}
