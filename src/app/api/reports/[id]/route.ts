/* ──────────────────────────────────────────
   API: /api/reports/[id] — single report ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, Mentor, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { rebuildRollupForWeek } from "@/services/rollup.service";
import { currentWeekKey } from "@/lib/date-helpers";

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
  let mentorDocId = null;
  if (session!.user.role === UserRole.MENTOR) {
    const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (mentorDoc) mentorDocId = mentorDoc._id.toString();

    if (report.mentor._id.toString() !== mentorDocId) {
      return jsonError("Forbidden", 403);
    }
  }

  return jsonOk(report);
}

// PATCH /api/reports/:id — update report (mentor can edit own; coordinator of that mentor; admin)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid body");

  await connectDB();

  const report = await WeeklyReport.findById(id);
  if (!report) return jsonError("Report not found", 404);

  // Time guard — only allow editing within the same ISO week
  if (report.weekKey !== currentWeekKey()) {
    return jsonError("This report can no longer be edited — the reporting week has ended.", 403);
  }

  const userRole = session!.user.role as UserRole;

  if (userRole === UserRole.MENTOR) {
    // Mentors can only update their own reports
    const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (!mentorDoc || report.mentor.toString() !== mentorDoc._id.toString()) {
      return jsonError("Forbidden", 403);
    }
  } else if (userRole === UserRole.COORDINATOR) {
    // Coordinators can only update reports from mentors assigned to them
    const coordDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (!coordDoc) return jsonError("Forbidden", 403);

    const mentorDoc = await Mentor.findById(report.mentor);
    if (!mentorDoc || mentorDoc.coordinator.toString() !== coordDoc._id.toString()) {
      return jsonError("Forbidden — this mentor is not assigned to you.", 403);
    }
  }
  // Admins can edit any report (no extra check needed)

  // Apply updates
  Object.assign(report, body);
  await report.save();

  // Rebuild rollup
  await rebuildRollupForWeek(report.weekKey);

  return jsonOk(report);
}
