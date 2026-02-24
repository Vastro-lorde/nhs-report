/* ──────────────────────────────────────────
   API: /api/alerts/[id] — update alert status
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Alert } from "@/models";
import { UserRole, AlertStatus } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
  if (error) return error;

  const { id } = await params;
  const body = await parseBody<{ status?: string; notes?: string }>(request);
  if (!body) return jsonError("Invalid body");

  await connectDB();

  const update: Record<string, unknown> = {};
  if (body.status && Object.values(AlertStatus).includes(body.status as AlertStatus)) {
    update.status = body.status;
    if (body.status === AlertStatus.RESOLVED) {
      update.resolvedBy = session!.user.id;
      update.resolvedAt = new Date();
    }
  }
  if (body.notes !== undefined) update.notes = body.notes;

  const alert = await Alert.findByIdAndUpdate(id, update, { new: true })
    .populate("mentor", "name email state")
    .lean();

  if (!alert) return jsonError("Alert not found", 404);
  return jsonOk(alert);
}
