/* ──────────────────────────────────────────
   API Route: /api/mentors/me
   GET — current user profile
   PATCH — update own name / phone
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const user = await User.findById(session!.user.id).select("-password").lean();
  if (!user) return jsonError("User not found", 404);
  return jsonOk(user);
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseBody<{ name?: string; phone?: string }>(request);
  if (!body) return jsonError("Invalid JSON", 400);

  await connectDB();
  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.phone !== undefined) updates.phone = body.phone;

  const user = await User.findByIdAndUpdate(session!.user.id, updates, {
    new: true,
    runValidators: true,
  })
    .select("-password")
    .lean();

  if (!user) return jsonError("User not found", 404);
  return jsonOk(user);
}
