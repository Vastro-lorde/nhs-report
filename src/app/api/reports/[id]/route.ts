/* ──────────────────────────────────────────
   API: /api/reports/[id] — single report ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { rebuildRollupForWeek } from "@/services/rollup.service";

type Params = { params: Promise<{ id: string }> };

// GET /api/reports/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const report = await WeeklyReport.findById(id)
    .populate("mentor", "name email state lgas")
    .lean();

  if (!report) return jsonError("Report not found", 404);

  // Mentors can only view their own
  if (
    session!.user.role === UserRole.MENTOR &&
    report.mentor._id.toString() !== session!.user.id
  ) {
    return jsonError("Forbidden", 403);
  }

  return jsonOk(report);
}

// PATCH /api/reports/:id — update report (mentor can edit own; admin can review)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid body");

  await connectDB();

  const report = await WeeklyReport.findById(id);
  if (!report) return jsonError("Report not found", 404);

  // Mentors can only update their own
  if (
    session!.user.role === UserRole.MENTOR &&
    report.mentor.toString() !== session!.user.id
  ) {
    return jsonError("Forbidden", 403);
  }

  // Apply updates
  Object.assign(report, body);
  await report.save();

  // Rebuild rollup
  await rebuildRollupForWeek(report.weekKey);

  return jsonOk(report);
}
