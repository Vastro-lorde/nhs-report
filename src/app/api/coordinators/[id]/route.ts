/* ──────────────────────────────────────────
   API: /api/coordinators/[id] — single coordinator ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/coordinators/:id
export async function GET(_request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const user = await User.findById(id).select("-password").lean();
    if (!user) return jsonError("Coordinator not found", 404);

    const coordinatorDoc = await Coordinator.findOne({ authId: user._id }).lean();
    const merged = {
        ...user,
        states: coordinatorDoc?.states || []
    };

    return jsonOk(merged);
}

// PATCH /api/coordinators/:id
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

    if (!updatedUser) return jsonError("Coordinator not found", 404);

    // Update Coordinator details
    const coordUpdate: any = {};
    if (states !== undefined) {
        coordUpdate.states = Array.isArray(states) ? states.map(s => s.toUpperCase().trim()) : states;
    }

    const coordDoc = await Coordinator.findOneAndUpdate(
        { authId: id },
        { $set: coordUpdate },
        { new: true, upsert: true }
    ).lean();

    const merged = {
        ...updatedUser,
        states: coordDoc?.states || []
    };

    return jsonOk(merged);
}

// DELETE /api/coordinators/:id — soft-delete (deactivate)
export async function DELETE(_request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const coordinator = await User.findByIdAndUpdate(id, { active: false }, { new: true })
        .select("-password")
        .lean();

    if (!coordinator) return jsonError("Coordinator not found", 404);

    return jsonOk({ message: "Coordinator deactivated", coordinator });
}
