/* ──────────────────────────────────────────
   API: /api/mentors/[id] — single mentor ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/mentors/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const mentor = await User.findById(id).select("-password").lean();
  if (!mentor) return jsonError("Mentor not found", 404);
  return jsonOk(mentor);
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

  await connectDB();
  const mentor = await User.findByIdAndUpdate(id, body, { new: true })
    .select("-password")
    .lean();
  if (!mentor) return jsonError("Mentor not found", 404);
  return jsonOk(mentor);
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
