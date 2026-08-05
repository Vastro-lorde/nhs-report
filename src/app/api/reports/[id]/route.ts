/* ──────────────────────────────────────────
   API: /api/reports/[id] — single report ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, Alert, Mentor, Coordinator, DeskOfficer, ReportHistory, AppSettings } from "@/models";
import {
  UserRole,
  ReportStatus,
  ReportHistoryReportType,
  ReportHistoryAction,
  normalizeLocation,
  resolveMentorStates,
  resolveStateForLGA,
} from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { rebuildRollupForWeek } from "@/services/rollup.service";
import { logActivity } from "@/lib/activity-logger";
import { currentWeekKey, isoWeekKey, parseInputDate, canonicalWeekEnding } from "@/lib/date-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/reports/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const report = await WeeklyReport.findById(id)
    .populate({
      path: "mentor",
      populate: { path: "authId", select: "name email phone active" },
      select: "states lgas coordinator",
    })
    .lean();

  if (!report) return jsonError("Report not found", 404);

  const mentorDoc: any = (report as any).mentor;

  if (!mentorDoc) return jsonError("Report mentor data not found", 404);

  // Mentors can only view their own
  if (session!.user.role === UserRole.MENTOR) {
    const myMentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (!myMentorDoc || mentorDoc._id.toString() !== myMentorDoc._id.toString()) {
      return jsonError("Forbidden", 403);
    }
  } else if ((report as any).status === ReportStatus.DRAFT) {
    // An unsubmitted draft is private to its author — it is excluded from every
    // listing, so a direct link must not be a way around that.
    return jsonError("Report not found", 404);
  }

  // Coordinators can only view reports from their assigned mentors
  if (session!.user.role === UserRole.COORDINATOR) {
    const coordDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (!coordDoc || !mentorDoc?.coordinator || mentorDoc.coordinator.toString() !== coordDoc._id.toString()) {
      return jsonError("Forbidden", 403);
    }
  }

  // Desk officers can only view reports from mentors in their assigned states
  if (session!.user.role === UserRole.ZONAL_DESK_OFFICER) {
    const deskOfficerDoc = await DeskOfficer.findOne({ authId: session!.user.id });
    if (!deskOfficerDoc || !deskOfficerDoc.states?.length) {
      return jsonError("Forbidden", 403);
    }
    // Include states implied by the mentor's LGAs — profiles often omit the
    // second state when a mentor picked up LGAs across a border.
    const mentorStates = resolveMentorStates(mentorDoc);
    const officerStates = deskOfficerDoc.states.map((s) => normalizeLocation(s));
    const hasOverlap = mentorStates.some((s: string) => officerStates.includes(s));
    if (!hasOverlap) {
      return jsonError("Forbidden", 403);
    }
  }

  const userRole = session!.user.role as UserRole;
  const settings =
    userRole === UserRole.MENTOR || userRole === UserRole.COORDINATOR
      ? await AppSettings.findOne({}).lean()
      : null;
  const isCurrentReportWeek = (report as any).weekKey === currentWeekKey();
  const canEdit =
    userRole === UserRole.ADMIN ||
    (userRole === UserRole.MENTOR && isCurrentReportWeek && !settings?.blockWeeklyReportEdits?.mentor) ||
    (userRole === UserRole.COORDINATOR && !settings?.blockWeeklyReportEdits?.coordinator);

  const mentorUser = mentorDoc?.authId;
  const mentorName = mentorUser?.name;
  const mentorEmail = mentorUser?.email;
  const mentorStatesForDisplay = resolveMentorStates(mentorDoc);
  const mentorState = mentorStatesForDisplay.length
    ? mentorStatesForDisplay.join(", ")
    : ((report as any).state ?? "");

  const reportObj = (report as any);
  const evidence = (reportObj.evidenceUrls ?? []).map((url: string, i: number) => ({
    url,
    comment: reportObj.evidenceComments?.[i] ?? "",
  }));
  const { evidenceUrls: _eu, evidenceComments: _ec, ...rest } = reportObj;

  return jsonOk({
    ...rest,
    canEdit,
    evidence,
    state: mentorState,
    states: mentorStatesForDisplay,
    mentorName,
    mentor: mentorDoc
      ? {
          _id: mentorDoc._id,
          name: mentorName,
          email: mentorEmail,
          state: mentorState,
          states: mentorStatesForDisplay,
        }
      : reportObj.mentor,
  });
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

  const userRole = session!.user.role as UserRole;

  if (userRole === UserRole.MENTOR) {
    // Mentors can only update their own reports
    const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (!mentorDoc || report.mentor.toString() !== mentorDoc._id.toString()) {
      return jsonError("Forbidden", 403);
    }
    if (report.weekKey !== currentWeekKey()) {
      return jsonError("Mentors can only edit weekly reports for the current week.", 403);
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

  // Check report-edit lock settings (admins bypass)
  if (userRole !== UserRole.ADMIN) {
    const settings = await AppSettings.findOne({}).lean();
    if (settings) {
      if (userRole === UserRole.MENTOR && settings.blockWeeklyReportEdits?.mentor) {
        return jsonError("Weekly report editing is currently disabled.", 403);
      }
      if (userRole === UserRole.COORDINATOR && settings.blockWeeklyReportEdits?.coordinator) {
        return jsonError("Weekly report editing is currently disabled.", 403);
      }
    }
  }

  // Convert evidence objects to parallel arrays for DB
  if (Array.isArray(body.evidence)) {
    (body as any).evidenceUrls = body.evidence.map((e: any) => e.url);
    (body as any).evidenceComments = body.evidence.map((e: any) => e.comment);
    delete body.evidence;
  }

  const previousWeekKey = report.weekKey;

  // If weekEnding is being updated, normalize it to the Sunday of its ISO
  // week and recompute weekKey. Reject if the new slot is already taken by
  // another report from the same mentor.
  if (typeof body.weekEnding === "string" || body.weekEnding instanceof Date) {
    const parsed = parseInputDate(body.weekEnding as string | Date);
    if (isNaN(parsed.getTime())) return jsonError("Invalid weekEnding date");
    const normalizedEnding = canonicalWeekEnding(parsed);
    const newWeekKey = isoWeekKey(parsed);
    if (newWeekKey !== report.weekKey) {
      const conflict = await WeeklyReport.findOne({
        _id: { $ne: report._id },
        mentor: report.mentor,
        weekKey: newWeekKey,
      });
      if (conflict) {
        return jsonError(
          `A report already exists for ${newWeekKey}. Edit that report instead.`,
          409,
        );
      }
    }
    (body as any).weekEnding = normalizedEnding;
    (body as any).weekKey = newWeekKey;
  }

  // Apply updates
  const wasDraft = report.status === ReportStatus.DRAFT;
  const snapshot = JSON.stringify(report.toObject());
  Object.assign(report, body);

  const isDraft = report.status === ReportStatus.DRAFT;
  // Quality flags belong to submitted work; recompute them on the way out of draft.
  if (wasDraft && !isDraft) {
    const flags: string[] = [];
    if (report.sessionsCount < 0) flags.push("Negative session count");
    if (report.urgentAlert && !report.urgentDetails) flags.push("Urgent alert marked but no details");
    report.dataQualityFlags = flags;
  }

  await report.save();

  // A draft that has just been submitted raises its alert now — creating it at
  // draft time would have paged coordinators about unfinished work.
  if (wasDraft && !isDraft && report.urgentAlert && report.urgentDetails) {
    const mentorDoc = await Mentor.findById(report.mentor);
    const mentorStates = resolveMentorStates(mentorDoc);
    const reportedStates = [
      ...new Set(
        [
          ...(report.fellows ?? []).map((f) => f.lga),
          ...(report.sessions ?? []).map((s) => s.menteeLGA),
        ]
          .map((lga) => resolveStateForLGA(lga, mentorStates))
          .filter((s): s is string => Boolean(s)),
      ),
    ];
    const alertStates = reportedStates.length ? reportedStates : mentorStates;

    await Alert.create({
      report: report._id,
      mentor: mentorDoc?.authId,
      weekKey: report.weekKey,
      state: alertStates[0] ?? "",
      states: alertStates,
      urgentDetails: report.urgentDetails,
    });
  }

  // Rebuild rollup for both old and new week if the key changed. Drafts are
  // excluded from roll-ups, but a rebuild is still needed when one is submitted
  // — or when a submitted report is pulled back into draft.
  if (!isDraft || wasDraft !== isDraft) {
    await rebuildRollupForWeek(report.weekKey);
    if (previousWeekKey && previousWeekKey !== report.weekKey) {
      await rebuildRollupForWeek(previousWeekKey);
    }
  }

  void ReportHistory.create({
    reportId: report._id,
    reportType: ReportHistoryReportType.WEEKLY_REPORT,
    action: ReportHistoryAction.UPDATED,
    snapshot,
    actorId: session!.user.id,
    actorName: session!.user.name,
    actorRole: session!.user.role,
  });

  void logActivity({ session, action: "UPDATE_REPORT", targetType: "Report", targetId: id, targetName: report.weekKey });
  return jsonOk(report);
}

// DELETE /api/reports/:id — admin or coordinator (own mentors) can delete weekly report
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userRole = session!.user.role as UserRole;

  if (userRole !== UserRole.ADMIN && userRole !== UserRole.COORDINATOR) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  await connectDB();

  const report = await WeeklyReport.findById(id);
  if (!report) return jsonError("Report not found", 404);

  // Coordinators can only delete reports from mentors assigned to them
  if (userRole === UserRole.COORDINATOR) {
    const coordDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (!coordDoc) return jsonError("Forbidden", 403);

    const mentorDoc = await Mentor.findById(report.mentor);
    if (!mentorDoc || mentorDoc.coordinator.toString() !== coordDoc._id.toString()) {
      return jsonError("Forbidden — this mentor is not assigned to you.", 403);
    }
  }

  const weekKey = report.weekKey;
  const deleteSnapshot = JSON.stringify(report.toObject());
  await WeeklyReport.findByIdAndDelete(id);

  // Rebuild rollup after deletion
  await rebuildRollupForWeek(weekKey);

  void ReportHistory.create({
    reportId: id,
    reportType: ReportHistoryReportType.WEEKLY_REPORT,
    action: ReportHistoryAction.DELETED,
    snapshot: deleteSnapshot,
    actorId: session!.user.id,
    actorName: session!.user.name,
    actorRole: session!.user.role,
  });

  void logActivity({ session, action: "DELETE_REPORT", targetType: "Report", targetId: id, targetName: weekKey });
  return jsonOk({ message: "Weekly report deleted" });
}
