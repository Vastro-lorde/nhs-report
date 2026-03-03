/* ──────────────────────────────────────────
   API: /api/admins/[id]
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(
    request: NextRequest,
    { params }: Params
) {
    try {
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const { id } = await params;
        const admin = await User.findOne({ _id: id, role: UserRole.ADMIN }).select("-password").lean();
        if (!admin) return jsonError("Admin not found", 404);

        return jsonOk(admin);
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: Params
) {
    try {
        const session = await auth();
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const body = await request.json();

        const { id } = await params;
        const targetAdmin = await User.findOne({ _id: id, role: UserRole.ADMIN });
        if (!targetAdmin) return jsonError("Admin not found", 404);

        // Prevent non-root admins from deactivating or modifying root admins
        if (targetAdmin.rootAdmin && !session?.user.rootAdmin) {
            return jsonError("Forbidden: Cannot modify a root administrator", 403);
        }

        // Update allowed fields (excluding role, email, password, and rootAdmin status)
        if (body.name !== undefined) targetAdmin.name = body.name;
        if (body.phone !== undefined) targetAdmin.phone = body.phone;
        if (body.active !== undefined) targetAdmin.active = body.active;

        await targetAdmin.save();

        const updated = targetAdmin.toObject();
        delete (updated as any).password;

        return jsonOk(updated);
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: Params
) {
    try {
        const session = await auth();
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const { id } = await params;
        const targetAdmin = await User.findOne({ _id: id, role: UserRole.ADMIN });
        if (!targetAdmin) return jsonError("Admin not found", 404);

        // Prevent non-root admins from deleting root admins
        if (targetAdmin.rootAdmin && !session?.user.rootAdmin) {
            return jsonError("Forbidden: Cannot delete a root administrator", 403);
        }

        await User.deleteOne({ _id: id });

        return jsonOk({ success: true, message: "Admin deleted successfully" });
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}
