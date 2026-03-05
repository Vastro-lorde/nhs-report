/* ──────────────────────────────────────────
   API: /api/desk-officers/[id] — single desk officer ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, DeskOfficer } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/desk-officers/:id
export async function GET(_request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const user = await User.findById(id).select("-password").lean();
    if (!user) return jsonError("Desk Officer not found", 404);

    const deskOfficerDoc = await DeskOfficer.findOne({ authId: user._id }).lean();
    const merged = {
        ...user,
        states: deskOfficerDoc?.states || []
    };

    return jsonOk(merged);
}

// PATCH /api/desk-officers/:id
export async function PATCH(request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    const body = await parseBody<Record<string, unknown>>(request);
    if (!body) return jsonError("Invalid body");

    // Prevent password/role update via this endpoint
    delete body.password;
    delete body.role;

    const { states, ...userUpdates } = body;

    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(id, userUpdates, { new: true })
        .select("-password")
        .lean();

    if (!updatedUser) return jsonError("Desk Officer not found", 404);

    // Update Desk Officer details
    const deskOfficerUpdate: any = {};
    if (states !== undefined) {
        deskOfficerUpdate.states = Array.isArray(states) ? states.map(s => s.toUpperCase().trim()) : states;
    }

    const deskOfficerDoc = await DeskOfficer.findOneAndUpdate(
        { authId: id },
        { $set: deskOfficerUpdate },
        { new: true, upsert: true }
    ).lean();

    const merged = {
        ...updatedUser,
        states: deskOfficerDoc?.states || []
    };

    return jsonOk(merged);
}

// DELETE /api/desk-officers/:id — soft-delete (deactivate)
export async function DELETE(_request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const deskOfficer = await User.findByIdAndUpdate(id, { active: false }, { new: true })
        .select("-password")
        .lean();

    if (!deskOfficer) return jsonError("Desk Officer not found", 404);

    return jsonOk({ message: "Desk Officer deactivated", deskOfficer });
}
