/* ──────────────────────────────────────────
   API: /api/coordinators/[id] — single coordinator ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Coordinator, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { removeMembersFromCohort } from "@/services/cohort.service";

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

    // Email changes must reset password and notify the new email.
    if (body.email !== undefined) {
        await connectDB();
        const current = await User.findById(id).select("email").lean();
        if (!current) return jsonError("Coordinator not found", 404);
        const incomingEmail = String(body.email ?? "").trim().toLowerCase();
        if (incomingEmail && incomingEmail !== String(current.email ?? "").toLowerCase()) {
            return jsonError("Use /api/coordinators/[id]/change-email to change login email", 400);
        }
        delete body.email;
    }

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

// DELETE /api/coordinators/:id — soft-delete (deactivate) or permanent delete for admins
export async function DELETE(request: NextRequest, { params }: Params) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    if (permanent) {
        const coordDoc = await Coordinator.findOne({ authId: id }).lean();
        if (coordDoc) {
            const mentorCount = await Mentor.countDocuments({ coordinator: coordDoc._id });
            if (mentorCount > 0) {
                return jsonError(
                    `Cannot permanently delete: this coordinator has ${mentorCount} mentor(s). Reassign or delete them first.`,
                    409
                );
            }
        }
        const deletedUser = await User.findById(id).select("name").lean();
        // Removes the coordinator from this cohort; their login is only deleted
        // when they belong to no other cohort, so earlier cohorts keep their history.
        await removeMembersFromCohort("coordinator", [id]);
        void logActivity({
          session,
          action: "PERMANENT_DELETE_COORDINATOR",
          targetType: "Coordinator",
          targetId: id,
          targetName: deletedUser?.name,
        });
        return jsonOk({ message: "Coordinator permanently deleted" });
    }

    const coordinator = await User.findByIdAndUpdate(id, { active: false }, { new: true })
        .select("-password")
        .lean();

    if (!coordinator) return jsonError("Coordinator not found", 404);

    void logActivity({
      session,
      action: "DEACTIVATE_COORDINATOR",
      targetType: "Coordinator",
      targetId: id,
      targetName: coordinator.name,
    });

    return jsonOk({ message: "Coordinator deactivated", coordinator });
}
