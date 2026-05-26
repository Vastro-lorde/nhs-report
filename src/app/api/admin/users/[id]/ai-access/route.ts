/* ──────────────────────────────────────────
   PATCH /api/admin/users/[id]/ai-access
   Toggle AI access for a user.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { User } from "@/models/User";
import { UserRole } from "@/lib/constants";

interface ToggleBody {
  aiAccessEnabled: boolean;
}

export const PATCH = withExceptionLog(
  "PATCH /api/admin/users/[id]/ai-access",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { session, error } = await requireRole("admin");
    if (error) return error;

    const { id } = await params;

    const body = await parseBody<ToggleBody>(req);
    if (body === null || typeof body.aiAccessEnabled !== "boolean") {
      return jsonError("aiAccessEnabled (boolean) is required.", 400);
    }

    await connectDB();

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return jsonError("User not found.", 404);
    }

    // Only root admins can toggle AI access for other admins or themselves
    if (targetUser.role === UserRole.ADMIN && !session!.user.rootAdmin) {
      return jsonError("Forbidden: Only root administrators can toggle AI access for administrators.", 403);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { aiAccessEnabled: body.aiAccessEnabled },
      { new: true, select: "name email role aiAccessEnabled" },
    );

    if (!updatedUser) {
      return jsonError("User not found.", 404);
    }

    void logActivity({
      session: session!,
      action: body.aiAccessEnabled ? "enable_ai_access" : "disable_ai_access",
      targetType: "User",
      targetId: id,
      targetName: updatedUser.name,
    });

    return jsonOk(updatedUser);
  },
);
