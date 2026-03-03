import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

export async function DELETE(request: NextRequest) {
    try {
        const { session, error } = await requireRole(UserRole.ADMIN);
        if (error) return error;

        const body = await parseBody<{ ids: string[] }>(request);
        if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
            return jsonError("Invalid payload. Expected an array of 'ids'.");
        }

        await connectDB();

        // 1. Delete the Auth user docs
        const deleteResult = await User.deleteMany({
            _id: { $in: body.ids },
            role: UserRole.COORDINATOR
        });

        // 2. Delete the Coordinator detail configs
        await Coordinator.deleteMany({
            authId: { $in: body.ids }
        });

        return jsonOk({
            success: true,
            deletedCount: deleteResult.deletedCount
        });
    } catch (globalErr: any) {
        console.error("Coordinator Bulk Delete Error:", globalErr);
        return jsonError(`Internal Server Error: ${globalErr.message}`, 500);
    }
}
