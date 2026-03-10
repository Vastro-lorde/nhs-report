/* ──────────────────────────────────────────
   API: /api/reports/[id]/comments
   GET  — list comments on a report
   POST — add a comment (coordinator, mentor, or admin)
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { WeeklyReport, Mentor, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/reports/:id/comments
export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const report = await WeeklyReport.findById(id).select("comments mentor").lean();
  if (!report) return jsonError("Report not found", 404);

  // Mentors can only see comments on their own reports
  if (session!.user.role === UserRole.MENTOR) {
    const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (!mentorDoc || report.mentor.toString() !== mentorDoc._id.toString()) {
      return jsonError("Forbidden", 403);
    }
  }

  return jsonOk(report.comments ?? []);
}

// POST /api/reports/:id/comments
export async function POST(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await parseBody<{ body: string }>(request);
  if (!body?.body?.trim()) return jsonError("Comment body is required");

  await connectDB();

  const report = await WeeklyReport.findById(id);
  if (!report) return jsonError("Report not found", 404);

  const userRole = session!.user.role as UserRole;

  // Only coordinators, mentors (own report), and admins may comment
  if (userRole === UserRole.MENTOR) {
    const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (!mentorDoc || report.mentor.toString() !== mentorDoc._id.toString()) {
      return jsonError("Forbidden", 403);
    }
  } else if (userRole === UserRole.COORDINATOR) {
    const coordDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (!coordDoc) return jsonError("Forbidden", 403);

    const mentorDoc = await Mentor.findById(report.mentor);
    if (!mentorDoc || mentorDoc.coordinator.toString() !== coordDoc._id.toString()) {
      return jsonError("Forbidden — this mentor is not assigned to you.", 403);
    }
  } else if (userRole !== UserRole.ADMIN) {
    return jsonError("Forbidden", 403);
  }

  const comment = {
    author: new Types.ObjectId(session!.user.id),
    authorName: session!.user.name ?? "Unknown",
    authorRole: userRole,
    body: body.body.trim(),
    createdAt: new Date(),
  };

  report.comments.push(comment);
  await report.save();

  void logActivity({
    session,
    action: "ADD_REPORT_COMMENT",
    targetType: "Report",
    targetId: id,
    targetName: report.weekKey,
  });

  // Return the newly added comment (last in array)
  const added = report.comments[report.comments.length - 1];
  return jsonOk(added, 201);
}
