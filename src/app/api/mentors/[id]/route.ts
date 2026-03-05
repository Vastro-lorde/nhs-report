/* ──────────────────────────────────────────
   API: /api/mentors/[id] — single mentor ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/mentors/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const targetId = id === "me" ? session.user.id : id;

  const isSelf = session.user.id === targetId;
  const allowedRoles: string[] = [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER];
  const isAuthorized = isSelf || allowedRoles.includes(session.user.role as string);

  if (!isAuthorized) {
    return jsonError("Forbidden", 403);
  }

  await connectDB();
  const user = await User.findById(targetId).select("-password").lean();
  if (!user) return jsonError("Mentor not found", 404);

  const mentorDoc = await Mentor.findOne({ authId: user._id }).lean();
  const merged = {
    ...user,
    states: mentorDoc?.states || [],
    lgas: mentorDoc?.lgas || []
  };

  return jsonOk(merged);
}

// PATCH /api/mentors/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid body");

  // Prevent password/role update via this endpoint
  delete body.password;
  delete body.role;

  const { states, lgas, ...userUpdates } = body;

  const updatedUser = await User.findByIdAndUpdate(id, userUpdates, { new: true })
    .select("-password")
    .lean();

  if (!updatedUser) return jsonError("Mentor not found", 404);

  // Update Mentor details
  const mentorUpdate: any = {};
  if (states !== undefined) mentorUpdate.states = Array.isArray(states) ? states.map(s => s.toUpperCase().trim()) : states;
  if (lgas !== undefined) mentorUpdate.lgas = Array.isArray(lgas) ? lgas.map(l => l.toUpperCase().trim()) : lgas;

  const mentorDoc = await Mentor.findOneAndUpdate(
    { authId: id },
    { $set: mentorUpdate },
    { new: true, upsert: true }
  ).lean();

  const merged = {
    ...updatedUser,
    states: mentorDoc?.states || [],
    lgas: mentorDoc?.lgas || []
  };

  return jsonOk(merged);
}

// DELETE /api/mentors/:id — soft-delete (deactivate)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const mentor = await User.findByIdAndUpdate(id, { active: false }, { new: true })
    .select("-password")
    .lean();
  if (!mentor) return jsonError("Mentor not found", 404);
  return jsonOk({ message: "Mentor deactivated", mentor });
}
