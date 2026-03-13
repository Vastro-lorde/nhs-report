/* ──────────────────────────────────────────
   API Route: /api/profile
   GET — current user profile
   PATCH — update own name / phone / profileImage
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { User, Mentor, Coordinator, DeskOfficer, MEOfficer } from "@/models";
import { UserRole } from "@/lib/constants";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const user = await User.findById(session!.user.id).select("-password").lean();
  if (!user) return jsonError("User not found", 404);

  // Attach role-specific details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleDetails: any = null;

  if (user.role === UserRole.MENTOR) {
    roleDetails = await Mentor.findOne({ authId: user._id })
      .populate("coordinator", "authId")
      .lean();
    // Resolve coordinator name
    if (roleDetails?.coordinator) {
      const coord = roleDetails.coordinator as { authId?: unknown };
      if (coord.authId) {
        const coordUser = await User.findById(coord.authId).select("name email").lean();
        roleDetails.coordinatorName = coordUser?.name ?? "—";
        roleDetails.coordinatorEmail = coordUser?.email ?? "—";
      }
    }
  } else if (user.role === UserRole.COORDINATOR) {
    roleDetails = await Coordinator.findOne({ authId: user._id }).lean();
  } else if (user.role === UserRole.ZONAL_DESK_OFFICER) {
    roleDetails = await DeskOfficer.findOne({ authId: user._id }).lean();
  } else if (user.role === UserRole.ME_OFFICER) {
    roleDetails = await MEOfficer.findOne({ authId: user._id }).lean();
  }

  return jsonOk({ ...user, roleDetails });
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseBody<{ name?: string; phone?: string; profileImage?: string }>(request);
  if (!body) return jsonError("Invalid JSON", 400);

  await connectDB();
  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.profileImage !== undefined) updates.profileImage = body.profileImage;

  const user = await User.findByIdAndUpdate(session!.user.id, updates, {
    new: true,
    runValidators: true,
  })
    .select("-password")
    .lean();

  if (!user) return jsonError("User not found", 404);
  return jsonOk(user);
}
