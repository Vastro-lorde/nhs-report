import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { removeMembersFromCohort } from "@/services/cohort.service";

export async function DELETE(request: NextRequest) {
    try {
        const { error } = await requireRole(UserRole.ADMIN);
        if (error) return error;

        const body = await parseBody<{ ids: string[] }>(request);
        if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
            return jsonError("Invalid payload. Expected an array of 'ids'.");
        }

        await connectDB();

        // Remove them from the cohort being viewed. A login is only deleted when
        // the person belongs to no other cohort, so earlier cohorts keep their history.
        const result = await removeMembersFromCohort("me_officer", body.ids);
        const deleteResult = { deletedCount: result.profilesRemoved };

        return jsonOk({
            success: true,
            deletedCount: deleteResult.deletedCount
        });
    } catch (globalErr: unknown) {
        const message = globalErr instanceof Error ? globalErr.message : String(globalErr);
        console.error("M&E Officer Bulk Delete Error:", globalErr);
        return jsonError(`Internal Server Error: ${message}`, 500);
    }
}
