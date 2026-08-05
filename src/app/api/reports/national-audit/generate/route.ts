/* ──────────────────────────────────────────
   POST /api/reports/national-audit/generate
   Generates a National Federal Oversight Report
   from all MentorMonthlyReport data via Gemini.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import {
  getZoneForState,
  GEOPOLITICAL_ZONES,
  resolveFellowState,
  resolveMentorStates,
} from "@/lib/constants";
import { generateNationalAudit } from "@/lib/gemini";
import { Mentor } from "@/models/Mentor";
import { Fellow } from "@/models/Fellow";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { format, parse } from "date-fns";

interface GenerateBody {
  month: string; // YYYY-MM
}

export const POST = withExceptionLog(
  "POST /api/reports/national-audit/generate",
  async (req: NextRequest) => {
    /* ── Auth ──────────────────────────────── */
    const { session, error } = await requireAuth();
    if (error) return error;

    if (!session!.user.aiAccessEnabled) {
      return jsonError("AI access is not enabled for your account.", 403);
    }

    if (session!.user.role !== "admin") {
      return jsonError("Only admins can generate national audit reports.", 403);
    }

    /* ── Body ──────────────────────────────── */
    const body = await parseBody<GenerateBody>(req);
    if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return jsonError("month (YYYY-MM format) is required.", 400);
    }

    await connectDB();

    /* ── All mentors ──────────────────────── */
    const mentors = await Mentor.find({})
      .populate("authId", "name email")
      .lean();
    const mentorIds = mentors.map((m) => m._id);

    if (!mentorIds.length) {
      return jsonError("No mentors found in the system.", 400);
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
    const mentorMap = new Map(
      mentors.map((m) => [
        m._id.toString(),
        {
          name: (m.authId as unknown as { name: string })?.name ?? "Unknown",
          // Includes states implied by assigned LGAs, not just the declared list.
          states: resolveMentorStates(m),
          lgas: m.lgas,
        },
      ]),
    );

    // Group fellows by zone → state → LGA.
    // The fellow's LGA decides its state and therefore its zone — a mentor with
    // fellows on both sides of a state border no longer has all of them filed
    // under states[0] (and, worse, under the wrong geopolitical zone).
    const fellowsByZoneStateLGA: Record<string, Record<string, Record<string, number>>> = {};
    for (const f of fellows) {
      const mentorInfo = mentorMap.get(f.mentor.toString());
      const state = resolveFellowState(f.lga, mentorInfo?.states) ?? "UNKNOWN";
      const zone = getZoneForState(state) ?? "Unknown Zone";
      if (!fellowsByZoneStateLGA[zone]) fellowsByZoneStateLGA[zone] = {};
      if (!fellowsByZoneStateLGA[zone][state]) fellowsByZoneStateLGA[zone][state] = {};
      const lga = f.lga || "UNKNOWN";
      fellowsByZoneStateLGA[zone][state][lga] = (fellowsByZoneStateLGA[zone][state][lga] || 0) + 1;
    }

    // Count totals — keyed by state so identically-named LGAs in different
    // states (SURULERE in Lagos and Oyo, OBI in Benue and Nasarawa …) count twice.
    const allLGAs = new Set<string>();
    for (const zoneObj of Object.values(fellowsByZoneStateLGA)) {
      for (const [state, stateObj] of Object.entries(zoneObj)) {
        for (const lga of Object.keys(stateObj)) {
          allLGAs.add(`${state}::${lga}`);
        }
      }
    }

    // Group reports by zone → state
    const zoneData: Record<
      string,
      Record<
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
      >
    > = {};

    for (const r of reports) {
      const mentorInfo = mentorMap.get(r.mentor.toString());
      const state = resolveFellowState(r.fellowLGA, mentorInfo?.states) ?? "UNKNOWN";
      const zone = getZoneForState(state) ?? "Unknown Zone";

      if (!zoneData[zone]) zoneData[zone] = {};
      if (!zoneData[zone][state]) {
        zoneData[zone][state] = { mentors: new Set(), fellows: new Set(), reports: [] };
      }

      zoneData[zone][state].mentors.add(r.mentor.toString());
      zoneData[zone][state].fellows.add(r.fellow.toString());
      zoneData[zone][state].reports.push({
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

    // Build national-level aggregated payload
    const zoneNames = Object.keys(GEOPOLITICAL_ZONES);
    const aggregatedPayload = {
      totalLGAs: allLGAs.size,
      totalActiveFellows: fellows.length,
      totalMentors: mentors.length,
      totalReports: reports.length,
      totalStates: new Set(
        mentors.flatMap((m) => resolveMentorStates(m)),
      ).size,
      zones: Object.fromEntries(
        zoneNames.map((zoneName) => {
          const statesInZone = zoneData[zoneName] ?? {};
          let zoneMentorCount = 0;
          let zoneFellowCount = 0;
          let zoneReportCount = 0;

          const statesPayload = Object.fromEntries(
            Object.entries(statesInZone).map(([state, data]) => {
              zoneMentorCount += data.mentors.size;
              zoneFellowCount += data.fellows.size;
              zoneReportCount += data.reports.length;
              return [
                state,
                {
                  mentorCount: data.mentors.size,
                  fellowCount: data.fellows.size,
                  reportCount: data.reports.length,
                  fellowsByLGA: fellowsByZoneStateLGA[zoneName]?.[state] ?? {},
                  reports: data.reports,
                },
              ];
            }),
          );

          return [
            zoneName,
            {
              mentorCount: zoneMentorCount,
              fellowCount: zoneFellowCount,
              reportCount: zoneReportCount,
              states: statesPayload,
            },
          ];
        }),
      ),
    };

    /* ── Reporting period label ────────────── */
    const parsedDate = parse(body.month, "yyyy-MM", new Date());
    const period = format(parsedDate, "MMMM, yyyy");

    /* ── Call Gemini ───────────────────────── */
    let auditReport;
    try {
      auditReport = await generateNationalAudit(aggregatedPayload, period);
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
      throw err;
    }

    /* ── Log activity ─────────────────────── */
    void logActivity({
      session: session!,
      action: "generate_national_audit",
      targetType: "NationalAudit",
      targetName: `National Audit - ${period}`,
      meta: {
        month: body.month,
        reportCount: reports.length,
        zoneCount: Object.keys(zoneData).length,
      },
    });

    return jsonOk(auditReport);
  },
);
