/* ──────────────────────────────────────────
   POST /api/reports/monthly/generate-ai
   Generates a structured zonal audit report
   from MentorMonthlyReport data via Gemini.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { getZoneForState } from "@/lib/constants";
import { generateZonalAudit } from "@/lib/gemini";
import { Coordinator } from "@/models/Coordinator";
import { Mentor } from "@/models/Mentor";
import { Fellow } from "@/models/Fellow";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { format, parse } from "date-fns";

interface GenerateBody {
  month: string; // YYYY-MM
}

export const POST = withExceptionLog(
  "POST /api/reports/monthly/generate-ai",
  async (req: NextRequest) => {
    /* ── Auth ──────────────────────────────── */
    const { session, error } = await requireAuth();
    if (error) return error;

    if (!session!.user.aiAccessEnabled) {
      return jsonError("AI access is not enabled for your account.", 403);
    }

    const userRole = session!.user.role;
    if (userRole !== "coordinator" && userRole !== "admin") {
      return jsonError("Only coordinators and admins can generate AI reports.", 403);
    }

    /* ── Body ──────────────────────────────── */
    const body = await parseBody<GenerateBody>(req);
    if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return jsonError("month (YYYY-MM format) is required.", 400);
    }

    await connectDB();

    /* ── Coordinator doc ───────────────────── */
    const coordinatorDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (!coordinatorDoc) {
      return jsonError("Coordinator profile not found.", 404);
    }

    const coordinatorStates = coordinatorDoc.states; // uppercase
    if (!coordinatorStates.length) {
      return jsonError("Coordinator has no assigned states.", 400);
    }

    /* ── Derive zone(s) ───────────────────── */
    const zoneSet = new Set<string>();
    for (const st of coordinatorStates) {
      const z = getZoneForState(st);
      if (z) zoneSet.add(z);
    }
    const zoneName = zoneSet.size > 0 ? [...zoneSet].join(" / ") : "Unknown Zone";

    /* ── Mentors under this coordinator ───── */
    const mentors = await Mentor.find({ coordinator: coordinatorDoc._id })
      .populate("authId", "name email")
      .lean();
    const mentorIds = mentors.map((m) => m._id);

    if (!mentorIds.length) {
      return jsonError("No mentors found under this coordinator.", 400);
    }

    /* ── MentorMonthlyReports for the month ─ */
    const reports = await MentorMonthlyReport.find({
      mentor: { $in: mentorIds },
      month: body.month,
      status: "submitted",
    }).lean();

    if (!reports.length) {
      return jsonError(
        `No submitted mentor monthly reports found for ${body.month}.`,
        400,
      );
    }

    /* ── Fellows for LGA counting ──────────── */
    const fellows = await Fellow.find({ mentor: { $in: mentorIds } }).lean();

    /* ── Build aggregated data payload ─────── */
    // Map mentor IDs to their info for lookup
    const mentorMap = new Map(
      mentors.map((m) => [
        m._id.toString(),
        {
          name: (m.authId as unknown as { name: string })?.name ?? "Unknown",
          states: m.states,
          lgas: m.lgas,
        },
      ]),
    );

    // Group fellows by state → LGA
    const fellowsByStateLGA: Record<string, Record<string, number>> = {};
    for (const f of fellows) {
      // Determine the state via the fellow's mentor
      const mentorInfo = mentorMap.get(f.mentor.toString());
      const state = mentorInfo?.states?.[0] ?? "UNKNOWN";
      if (!fellowsByStateLGA[state]) fellowsByStateLGA[state] = {};
      const lga = f.lga || "UNKNOWN";
      fellowsByStateLGA[state][lga] = (fellowsByStateLGA[state][lga] || 0) + 1;
    }

    // Count total unique LGAs and active fellows
    const allLGAs = new Set<string>();
    for (const stateObj of Object.values(fellowsByStateLGA)) {
      for (const lga of Object.keys(stateObj)) {
        allLGAs.add(lga);
      }
    }

    // Group reports by state → LGA
    const stateData: Record<
      string,
      {
        mentors: Set<string>;
        fellows: Set<string>;
        reports: Array<{
          mentorName: string;
          fellowName: string;
          fellowLGA: string;
          fellowQualification: string;
          sessionsHeld: number;
          sessionsAttended: number;
          sessionsAbsent: number;
          summaryLearning: string;
          summaryPhcVisits: string;
          summaryActivities: string;
          summaryGrowth: string;
          summaryImpact: string;
          challenges: string[];
          recommendations: string[];
          achievements: string;
          progressRating: string;
        }>;
      }
    > = {};

    for (const r of reports) {
      const mentorInfo = mentorMap.get(r.mentor.toString());
      const state = mentorInfo?.states?.[0] ?? "UNKNOWN";

      if (!stateData[state]) {
        stateData[state] = { mentors: new Set(), fellows: new Set(), reports: [] };
      }

      stateData[state].mentors.add(r.mentor.toString());
      stateData[state].fellows.add(r.fellow.toString());
      stateData[state].reports.push({
        mentorName: mentorInfo?.name ?? "Unknown",
        fellowName: r.fellowName,
        fellowLGA: r.fellowLGA,
        fellowQualification: r.fellowQualification,
        sessionsHeld: r.sessionsHeld,
        sessionsAttended: r.sessionsAttended,
        sessionsAbsent: r.sessionsAbsent,
        summaryLearning: r.summaryLearning,
        summaryPhcVisits: r.summaryPhcVisits,
        summaryActivities: r.summaryActivities,
        summaryGrowth: r.summaryGrowth,
        summaryImpact: r.summaryImpact,
        challenges: r.challenges,
        recommendations: r.recommendations,
        achievements: r.achievements,
        progressRating: r.progressRating,
      });
    }

    // Convert sets to counts for the AI payload
    const aggregatedPayload = {
      zoneName,
      coordinatorStates,
      totalLGAs: allLGAs.size,
      activeFellows: fellows.length,
      totalMentors: mentors.length,
      totalReports: reports.length,
      states: Object.fromEntries(
        Object.entries(stateData).map(([state, data]) => [
          state,
          {
            mentorCount: data.mentors.size,
            fellowCount: data.fellows.size,
            reportCount: data.reports.length,
            fellowsByLGA: fellowsByStateLGA[state] || {},
            reports: data.reports,
          },
        ]),
      ),
    };

    /* ── Reporting period label ────────────── */
    const parsedDate = parse(body.month, "yyyy-MM", new Date());
    const period = format(parsedDate, "MMMM, yyyy");

    /* ── Call Gemini ───────────────────────── */
    let auditReport;
    try {
      auditReport = await generateZonalAudit(aggregatedPayload, zoneName, period);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("quota") || msg.includes("credits")) {
        return jsonError(
          "AI service quota exceeded. Please try again later or contact an administrator.",
          503,
        );
      }
      if (msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("high demand")) {
        return jsonError(
          "The AI model is currently experiencing high demand. Please try again in a few minutes.",
          503,
        );
      }
      if (msg.includes("403") || msg.includes("API_KEY")) {
        return jsonError("AI service authentication failed. Please contact an administrator.", 503);
      }
      throw err; // re-throw for withExceptionLog to handle
    }

    /* ── Log activity ─────────────────────── */
    void logActivity({
      session: session!,
      action: "generate_ai_zonal_audit",
      targetType: "MonthlyReport",
      targetName: `${zoneName} - ${period}`,
      meta: {
        month: body.month,
        zone: zoneName,
        states: coordinatorStates,
        reportCount: reports.length,
      },
    });

    return jsonOk(auditReport);
  },
);
