/* ──────────────────────────────────────────
   API: /api/reports — submit & list reports
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, Alert, User } from "@/models";
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

  // Mentors can only see their own reports
  if (session!.user.role === UserRole.MENTOR) {
    filter.mentor = session!.user.id;
  }

  const weekKey = url.searchParams.get("weekKey");
  const mentorId = url.searchParams.get("mentorId");
  const state = url.searchParams.get("state");

  if (weekKey) filter.weekKey = weekKey;
  if (mentorId && session!.user.role !== UserRole.MENTOR) filter.mentor = mentorId;
  if (state) {
    // Need to find mentors in that state first
    const mentorIds = await User.find({ state, role: UserRole.MENTOR }).distinct("_id");
    filter.mentor = { $in: mentorIds };
  }

  const [reports, total] = await Promise.all([
    WeeklyReport.find(filter)
      .populate("mentor", "name email state")
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
  const mentorId = session!.user.id;

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
    const mentor = await User.findById(mentorId).lean();
    await Alert.create({
      report: report._id,
      mentor: mentorId,
      weekKey,
      state: mentor?.state ?? "",
      urgentDetails: body.urgentDetails,
    });
  }

  // Rebuild rollup for this week
  await rebuildRollupForWeek(weekKey);

  return jsonCreated(report);
}
