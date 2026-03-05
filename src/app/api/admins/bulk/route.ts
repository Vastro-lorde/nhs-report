/* ──────────────────────────────────────────
   API: /api/admins/bulk
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        await requireRole(UserRole.ADMIN);
        await connectDB();

        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return jsonError("No admin IDs provided", 400);
        }

        // Find all targeted admins first to check for root admin privileges
        const targetAdmins = await User.find({ _id: { $in: ids }, role: UserRole.ADMIN });

        // If current user is not a root admin, filter out any root admins from the deletion target
        const isRootAdmin = session?.user?.rootAdmin;
        let deletableIds = targetAdmins.map(admin => admin._id.toString());

        if (!isRootAdmin) {
            const rootAdminIds = targetAdmins.filter(admin => admin.rootAdmin).map(admin => admin._id.toString());
            if (rootAdminIds.length > 0) {
                deletableIds = deletableIds.filter(id => !rootAdminIds.includes(id));

                // If the user *only* selected root admins, return an error
                if (deletableIds.length === 0) {
                    return jsonError("Forbidden: Cannot delete root administrators", 403);
                }
            }
        }

        const result = await User.deleteMany({ _id: { $in: deletableIds }, role: UserRole.ADMIN });

        let message = `Successfully deleted ${result.deletedCount} admin(s).`;
        if (!isRootAdmin && deletableIds.length < targetAdmins.length) {
            message += ` Some selections were skipped because they are root administrators.`;
        }

        return jsonOk({ success: true, deletedCount: result.deletedCount, message });
    } catch (error: any) {
        return jsonError(error.message, error.status || 500);
    }
}
