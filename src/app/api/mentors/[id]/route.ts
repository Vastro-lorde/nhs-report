/* ──────────────────────────────────────────
   API: /api/mentors/[id] — single mentor ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Mentor, Coordinator, DeskOfficer } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/mentors/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const targetId = id === "me" ? session.user.id : id;

  const isSelf = session.user.id === targetId;
  const allowedRoles: string[] = [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER];
  const isAuthorized = isSelf || allowedRoles.includes(session.user.role as string);

  if (!isAuthorized) {
    return jsonError("Forbidden", 403);
  }

  await connectDB();
  const user = await User.findById(targetId).select("-password").lean();
  if (!user) return jsonError("Mentor not found", 404);

  const mentorDoc = await Mentor.findOne({ authId: user._id }).lean();
  if (session.user.role === UserRole.COORDINATOR) {
    const coordinator = await Coordinator.findOne({ authId: session.user.id }).lean();
    if (!coordinator) return jsonError("Coordinator record not found", 404);
    if (!mentorDoc || mentorDoc.coordinator.toString() !== coordinator._id.toString()) {
      return jsonError("Mentor not found", 404);
    }
  }
  if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
    const deskOfficer = await DeskOfficer.findOne({ authId: session.user.id }).lean();
    if (!deskOfficer) return jsonError("Desk officer record not found", 404);
    const allowedStates = (deskOfficer.states || []).map((s) => s.toUpperCase().trim()).filter(Boolean);
    if (!mentorDoc || !allowedStates.length) return jsonError("Mentor not found", 404);

    const allowedSet = new Set(allowedStates);
    const mentorStates = (mentorDoc.states || []).map((s) => String(s).toUpperCase().trim()).filter(Boolean);
    const isInScope = mentorStates.some((s) => allowedSet.has(s));
    if (!isInScope) return jsonError("Mentor not found", 404);
  }
  const merged = {
    ...user,
    states: mentorDoc?.states || [],
    lgas: mentorDoc?.lgas || []
  };

  return jsonOk(merged);
}

// PATCH /api/mentors/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
  if (error) return error;

  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid body");

  await connectDB();

  // Coordinators may only update their own mentors
  if (session?.user.role === UserRole.COORDINATOR) {
    const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
    if (!coordinatorDoc) return jsonError("Coordinator record not found", 404);
    const mentorDoc = await Mentor.findOne({ authId: id }).lean();
    if (!mentorDoc || mentorDoc.coordinator.toString() !== coordinatorDoc._id.toString()) {
      return jsonError("Mentor not found", 404);
    }
  }

  // Prevent password/role update via this endpoint
  delete body.password;
  delete body.role;

  // Email changes must reset password and notify the new email.
  if (body.email !== undefined) {
    const current = await User.findById(id).select("email").lean();
    if (!current) return jsonError("Mentor not found", 404);
    const incomingEmail = String(body.email ?? "").trim().toLowerCase();
    if (incomingEmail && incomingEmail !== String(current.email ?? "").toLowerCase()) {
      return jsonError("Use /api/mentors/[id]/change-email to change login email", 400);
    }
    delete body.email;
  }

  const { states, lgas, coordinatorId, ...userUpdates } = body;

  const updatedUser = await User.findByIdAndUpdate(id, userUpdates, { new: true })
    .select("-password")
    .lean();

  if (!updatedUser) return jsonError("Mentor not found", 404);

  // Update Mentor details
  const mentorUpdate: Record<string, unknown> = {};
  if (states !== undefined) mentorUpdate.states = Array.isArray(states) ? states.map(s => String(s).toUpperCase().trim()) : states;
  if (lgas !== undefined) mentorUpdate.lgas = Array.isArray(lgas) ? lgas.map(l => String(l).toUpperCase().trim()) : lgas;

  // Reassign coordinator — admin only
  const isReassign = coordinatorId !== undefined && session?.user.role === UserRole.ADMIN;
  if (isReassign) {
    const targetCoord = await Coordinator.findById(coordinatorId).lean();
    if (!targetCoord) return jsonError("Target coordinator does not exist", 404);
    mentorUpdate.coordinator = coordinatorId;
  }

  const mentorDoc = await Mentor.findOneAndUpdate(
    { authId: id },
    { $set: mentorUpdate },
    { new: true, upsert: true }
  ).lean();

  if (isReassign) {
    void logActivity({
      session,
      action: "REASSIGN_MENTOR",
      targetType: "Mentor",
      targetId: id,
      targetName: updatedUser.name,
      meta: { newCoordinatorId: coordinatorId },
    });
  }

  const merged = {
    ...updatedUser,
    states: mentorDoc?.states || [],
    lgas: mentorDoc?.lgas || []
  };

  return jsonOk(merged);
}

// DELETE /api/mentors/:id — soft-delete (deactivate) or permanent delete for admins
export async function DELETE(request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
  if (error) return error;

  const { id } = await params;
  await connectDB();

  // Coordinators may only deactivate their own mentors
  if (session?.user.role === UserRole.COORDINATOR) {
    const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
    if (!coordinatorDoc) return jsonError("Coordinator record not found", 404);
    const mentorDoc = await Mentor.findOne({ authId: id }).lean();
    if (!mentorDoc || mentorDoc.coordinator.toString() !== coordinatorDoc._id.toString()) {
      return jsonError("Mentor not found", 404);
    }
    // Coordinators can only soft-delete
    const mentor = await User.findByIdAndUpdate(id, { active: false }, { new: true })
      .select("-password")
      .lean();
    if (!mentor) return jsonError("Mentor not found", 404);
    void logActivity({
      session,
      action: "DEACTIVATE_MENTOR",
      targetType: "Mentor",
      targetId: id,
      targetName: mentor.name,
    });
    return jsonOk({ message: "Mentor deactivated", mentor });
  }

  // Admin: permanent or soft delete
  const url = new URL(request.url);
  const permanent = url.searchParams.get("permanent") === "true";

  if (permanent) {
    const targetUser = await User.findById(id).select("name").lean();
    await User.findByIdAndDelete(id);
    await Mentor.deleteOne({ authId: id });
    void logActivity({
      session,
      action: "PERMANENT_DELETE_MENTOR",
      targetType: "Mentor",
      targetId: id,
      targetName: targetUser?.name,
    });
    return jsonOk({ message: "Mentor permanently deleted" });
  }

  const mentor = await User.findByIdAndUpdate(id, { active: false }, { new: true })
    .select("-password")
    .lean();
  if (!mentor) return jsonError("Mentor not found", 404);
  void logActivity({
    session,
    action: "DEACTIVATE_MENTOR",
    targetType: "Mentor",
    targetId: id,
    targetName: mentor.name,
  });
  return jsonOk({ message: "Mentor deactivated", mentor });
}
