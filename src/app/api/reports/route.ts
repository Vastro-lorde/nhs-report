/* ──────────────────────────────────────────
   API: /api/reports — submit & list reports
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, Alert, User, Mentor, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";
import { isoWeekKey } from "@/lib/date-helpers";
import { rebuildRollupForWeek } from "@/services/rollup.service";

// GET /api/reports — list reports
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);

  const filter: Record<string, unknown> = {};

  // Get Mentor ID for mentors
  let mentorDocId = null;
  if (session!.user.role === UserRole.MENTOR) {
    const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
    if (mentorDoc) {
      mentorDocId = mentorDoc._id;
      filter.mentor = mentorDocId;
    } else {
      return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
  }

  const weekKey = url.searchParams.get("weekKey");
  const mentorId = url.searchParams.get("mentorId");
  const state = url.searchParams.get("state");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (weekKey) filter.weekKey = weekKey;

  if (startDate || endDate) {
    filter.weekEnding = {};
    if (startDate) (filter.weekEnding as any).$gte = new Date(startDate);
    if (endDate) (filter.weekEnding as any).$lte = new Date(endDate);
  }

  if (session!.user.role !== UserRole.MENTOR) {
    const mentorFilter: Record<string, unknown> = {};
    let mustFilterByMentorIds = false;

    if (session!.user.role === UserRole.COORDINATOR) {
      const coordinatorDoc = await Coordinator.findOne({ authId: session!.user.id });
      if (coordinatorDoc) {
        mentorFilter.coordinator = coordinatorDoc._id;
        mustFilterByMentorIds = true;
      } else {
        // Coordinator without a profile, return empty
        return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }

    if (state) {
      mentorFilter.state = state.toUpperCase();
      mustFilterByMentorIds = true;
    }
    if (mentorId) {
      mentorFilter._id = mentorId;
      mustFilterByMentorIds = true;
    }

    if (mustFilterByMentorIds) {
      const mentorIds = await Mentor.find(mentorFilter).distinct("_id");
      filter.mentor = { $in: mentorIds };
    }
  }

  const [reports, total] = await Promise.all([
    WeeklyReport.find(filter)
      .populate({
        path: "mentor",
        populate: { path: "authId", select: "name email phone active" },
        select: "state lgas"
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    WeeklyReport.countDocuments(filter),
  ]);

  return jsonOk({
    data: reports,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/reports — submit a weekly report
interface SessionBody {
  menteeName: string;
  menteeLGA?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  duration: string;
  topicDiscussed: string;
  challenges: string[];
  solutions: string[];
  actionPlan: string[];
}

interface CreateReportBody {
  weekEnding: string;
  weekNumber?: number;
  coverNote?: string;
  fellows?: { name: string; lga: string }[];
  sessions?: SessionBody[];
  sessionsCount: number;
  menteesCheckedIn: number;
  outreachActivities: string[];
  outreachDescription?: string;
  keyWins?: string;
  challenges: string[];
  challengeDescription?: string;
  urgentAlert: boolean;
  urgentDetails?: string;
  supportNeeded?: string;
  evidenceUrls?: string[];
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await parseBody<CreateReportBody>(request);
  if (!body || !body.weekEnding) {
    return jsonError("weekEnding is required");
  }

  await connectDB();

  const weekEnding = new Date(body.weekEnding);
  if (isNaN(weekEnding.getTime())) return jsonError("Invalid weekEnding date");

  const weekKey = isoWeekKey(weekEnding);

  const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
  if (!mentorDoc) return jsonError("Mentor profile not found", 403);
  const mentorId = mentorDoc._id;

  // Validate data quality
  const flags: string[] = [];
  if (body.sessionsCount < 0) flags.push("Negative session count");
  if (body.urgentAlert && !body.urgentDetails) flags.push("Urgent alert marked but no details");

  // Check for duplicate
  const existingReport = await WeeklyReport.findOne({ mentor: mentorId, weekKey });
  if (existingReport) {
    return jsonError(`Report for ${weekKey} already submitted. Use PATCH to update.`, 409);
  }

  // Derive session count from sessions array if provided
  const sessionsArr = body.sessions ?? [];
  const derivedSessionCount = sessionsArr.length || body.sessionsCount || 0;
  const derivedMenteesCount = sessionsArr.length
    ? new Set(sessionsArr.map((s) => s.menteeName.toLowerCase().trim())).size
    : body.menteesCheckedIn || 0;

  const report = await WeeklyReport.create({
    mentor: mentorId,
    weekEnding,
    weekNumber: body.weekNumber,
    weekKey,
    coverNote: body.coverNote,
    fellows: body.fellows ?? [],
    sessions: sessionsArr.map((s) => ({
      ...s,
      sessionDate: new Date(s.sessionDate),
    })),
    sessionsCount: derivedSessionCount,
    menteesCheckedIn: derivedMenteesCount,
    outreachActivities: body.outreachActivities ?? [],
    outreachDescription: body.outreachDescription,
    keyWins: body.keyWins,
    challenges: body.challenges ?? [],
    challengeDescription: body.challengeDescription,
    urgentAlert: body.urgentAlert ?? false,
    urgentDetails: body.urgentDetails,
    supportNeeded: body.supportNeeded,
    evidenceUrls: body.evidenceUrls ?? [],
    dataQualityFlags: flags,
  });

  // Create alert if urgent
  if (body.urgentAlert && body.urgentDetails) {
    await Alert.create({
      report: report._id,
      mentor: mentorId,
      weekKey,
      state: mentorDoc.state ?? "",
      urgentDetails: body.urgentDetails,
    });
  }

  // Rebuild rollup for this week
  await rebuildRollupForWeek(weekKey);

  return jsonCreated(report);
}
