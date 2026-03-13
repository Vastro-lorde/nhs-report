/* ──────────────────────────────────────────
   API: /api/me-officers/[id] — single M&E officer ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/me-officers/:id
export async function GET(_request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const user = await User.findById(id).select("-password").lean();
    if (!user) return jsonError("M&E Officer not found", 404);

    return jsonOk(user);
}

// PATCH /api/me-officers/:id
export async function PATCH(request: NextRequest, { params }: Params) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    const body = await parseBody<Record<string, unknown>>(request);
    if (!body) return jsonError("Invalid body");

    // Prevent password/role update via this endpoint
    delete body.password;
    delete body.role;

    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(id, body, { new: true })
        .select("-password")
        .lean();

    if (!updatedUser) return jsonError("M&E Officer not found", 404);

    void logActivity({ session, action: "UPDATE_ME_OFFICER", targetType: "MEOfficer", targetId: id, targetName: updatedUser.name });
    return jsonOk(updatedUser);
}

// DELETE /api/me-officers/:id — soft-delete (deactivate)
export async function DELETE(_request: NextRequest, { params }: Params) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const meOfficer = await User.findByIdAndUpdate(id, { active: false }, { new: true })
        .select("-password")
        .lean();

    if (!meOfficer) return jsonError("M&E Officer not found", 404);

    void logActivity({ session, action: "DEACTIVATE_ME_OFFICER", targetType: "MEOfficer", targetId: id, targetName: meOfficer.name });
    return jsonOk({ message: "M&E Officer deactivated", meOfficer });
}
