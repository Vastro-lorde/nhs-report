/* ──────────────────────────────────────────
   API Route: /api/mentors/me/password
   PATCH — change own password
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseBody<{ currentPassword: string; newPassword: string }>(request);
  if (!body?.currentPassword || !body?.newPassword)
    return jsonError("currentPassword and newPassword required", 400);

  if (body.newPassword.length < 6)
    return jsonError("New password must be at least 6 characters", 400);

  await connectDB();
  const user = await User.findById(session!.user.id).select("+password");
  if (!user) return jsonError("User not found", 404);

  const valid = await bcrypt.compare(body.currentPassword, user.password);
  if (!valid) return jsonError("Current password is incorrect", 401);

  user.password = await bcrypt.hash(body.newPassword, 12);
  await user.save();

  return jsonOk({ message: "Password changed" });
}
