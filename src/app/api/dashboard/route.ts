/* ──────────────────────────────────────────
   API: /api/dashboard — aggregated stats for dashboard
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, User, Alert, WeeklyRollup, Mentor, Coordinator, DeskOfficer, Fellow } from "@/models";
import mongoose from "mongoose";
import { UserRole, AlertStatus, resolveMentorStates, resolveStateForLGA } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { currentWeekKey, isoWeekKey } from "@/lib/date-helpers";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const user = session!.user;

    await connectDB();

    const weekKey = currentWeekKey();

    // ── Date range params ──
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let fromWeekKey: string | undefined;
    let toWeekKey: string | undefined;
    if (fromParam) fromWeekKey = isoWeekKey(new Date(fromParam));
    if (toParam) toWeekKey = isoWeekKey(new Date(toParam));

    const hasDateRange = !!(fromWeekKey || toWeekKey);

    // Scoping logic
    let mentorAuthIds: string[] | undefined = undefined;
    let mentorDocIds: string[] | undefined = undefined;

    if (user.role === UserRole.COORDINATOR) {
      const coordinator = await Coordinator.findOne({ authId: user.id }).lean();
      if (coordinator) {
        const mentors = await Mentor.find({ coordinator: coordinator._id }).lean();
        mentorAuthIds = mentors.map(m => m.authId.toString());
        mentorDocIds = mentors.map(m => m._id.toString());
      } else {
        mentorAuthIds = [];
        mentorDocIds = [];
      }
    } else if (user.role === UserRole.ZONAL_DESK_OFFICER) {
      const deskOfficer = await DeskOfficer.findOne({ authId: user.id }).lean();
      if (deskOfficer && deskOfficer.states && deskOfficer.states.length > 0) {
        const mentors = await Mentor.find({ states: { $in: deskOfficer.states } }).lean();
        mentorAuthIds = mentors.map(m => m.authId.toString());
        mentorDocIds = mentors.map(m => m._id.toString());
      } else {
        mentorAuthIds = [];
        mentorDocIds = [];
      }
    }

    const baseMentorFilter: any = { role: UserRole.MENTOR };
    if (mentorAuthIds) baseMentorFilter._id = { $in: mentorAuthIds };

    const activeMentorFilter: any = { ...baseMentorFilter, active: true };

    const reportFilter: any = { weekKey };
    if (mentorDocIds) reportFilter.mentor = { $in: mentorDocIds };

    // Date-ranged report filter: used for scoped counts when a date range is specified
    const rangedReportFilter: any = {};
    if (mentorDocIds) rangedReportFilter.mentor = { $in: mentorDocIds };
    if (hasDateRange) {
      rangedReportFilter.weekKey = {};
      if (fromWeekKey) rangedReportFilter.weekKey.$gte = fromWeekKey;
      if (toWeekKey) rangedReportFilter.weekKey.$lte = toWeekKey;
    }

    const alertFilter: any = { status: { $ne: AlertStatus.RESOLVED } };
    // Alert.mentor references User (authId), but older rows stored the Mentor
    // document id — match both so scoped counts don't silently miss alerts.
    if (mentorAuthIds) alertFilter.mentor = { $in: [...mentorAuthIds, ...(mentorDocIds ?? [])] };

    const isZoneScoped = user.role === UserRole.COORDINATOR || user.role === UserRole.ZONAL_DESK_OFFICER;

    const fellowFilter: any = {};
    if (mentorDocIds) {
      fellowFilter.mentor = { $in: mentorDocIds };
    }

    // Build weekKey filter for rollups
    const rollupWeekFilter: any = {};
    if (fromWeekKey) rollupWeekFilter.weekKey = { ...rollupWeekFilter.weekKey, $gte: fromWeekKey };
    if (toWeekKey) rollupWeekFilter.weekKey = { ...rollupWeekFilter.weekKey, $lte: toWeekKey };

    const [
      totalMentors,
      activeMentors,
      reportsThisWeek,
      openAlerts,
      latestRollups,
      totalFellows,
    ] = await Promise.all([
      User.countDocuments(baseMentorFilter),
      User.countDocuments(activeMentorFilter),
      WeeklyReport.countDocuments(hasDateRange ? rangedReportFilter : reportFilter),
      Alert.countDocuments(alertFilter),
      // Admins, ME Officers & Team Research Leads get pre-computed global rollups; zone-scoped roles get zone-scoped rollups
      user.role === UserRole.ADMIN || user.role === UserRole.ME_OFFICER || user.role === UserRole.TEAM_RESEARCH_LEAD
        ? WeeklyRollup.find(rollupWeekFilter).sort({ weekKey: -1 }).limit(hasDateRange ? 52 : 12).lean()
        : isZoneScoped
          ? buildZoneScopedRollups(mentorDocIds ?? [], mentorDocIds?.length ?? 0, fromWeekKey, toWeekKey)
          : Promise.resolve([]),
      Fellow.countDocuments(fellowFilter),
    ]);

    // Aggregate submissions by state
    const aggregatePipeline: any[] = [];

    // Date range match
    const reportMatchStage: any = {};
    if (mentorDocIds) {
      reportMatchStage.mentor = { $in: mentorDocIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (fromWeekKey || toWeekKey) {
      reportMatchStage.weekKey = {};
      if (fromWeekKey) reportMatchStage.weekKey.$gte = fromWeekKey;
      if (toWeekKey) reportMatchStage.weekKey.$lte = toWeekKey;
    }
    if (Object.keys(reportMatchStage).length > 0) {
      aggregatePipeline.push({ $match: reportMatchStage });
    }

    // Project one compact row per report and resolve its state in JS. Unwinding
    // `mentorData.states` counted a report (and all its sessions) once per state
    // the mentor covers, so a mentor working across two states doubled every
    // figure on this chart. A report belongs to one state: the one most of its
    // mentees' LGAs sit in.
    aggregatePipeline.push(
      {
        $lookup: {
          from: "mentors",
          localField: "mentor",
          foreignField: "_id",
          as: "mentorData",
        },
      },
      { $unwind: { path: "$mentorData", preserveNullAndEmptyArrays: true } },
      { $sort: { weekKey: -1 } },
      { $limit: 5000 },
      {
        $project: {
          _id: 0,
          weekKey: 1,
          sessionsCount: 1,
          menteesCheckedIn: 1,
          mentorStates: "$mentorData.states",
          mentorLgas: "$mentorData.lgas",
          sessionLgas: "$sessions.menteeLGA",
          fellowLgas: "$fellows.lga",
        },
      }
    );

    const reportRows = await WeeklyReport.aggregate(aggregatePipeline);

    const stateWeekTotals = new Map<
      string,
      { state: string; weekKey: string; count: number; sessions: number; checkins: number }
    >();

    for (const row of reportRows) {
      const mentorStates = resolveMentorStates({
        states: row.mentorStates,
        lgas: row.mentorLgas,
      });
      const lgas = [...(row.sessionLgas ?? []), ...(row.fellowLgas ?? [])].filter(Boolean);

      // Majority state across the LGAs actually worked in this week.
      const tally = new Map<string, number>();
      for (const lga of lgas) {
        const state = resolveStateForLGA(lga, mentorStates);
        if (state) tally.set(state, (tally.get(state) ?? 0) + 1);
      }
      let state = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!state) state = mentorStates.length === 1 ? mentorStates[0] : "Unknown";

      const key = `${state}::${row.weekKey}`;
      const bucket = stateWeekTotals.get(key) ?? {
        state,
        weekKey: row.weekKey,
        count: 0,
        sessions: 0,
        checkins: 0,
      };
      bucket.count += 1;
      bucket.sessions += row.sessionsCount ?? 0;
      bucket.checkins += row.menteesCheckedIn ?? 0;
      stateWeekTotals.set(key, bucket);
    }

    const submissionsByState = [...stateWeekTotals.values()]
      .sort((a, b) => (a.weekKey < b.weekKey ? 1 : a.weekKey > b.weekKey ? -1 : 0))
      .slice(0, 200)
      .map(({ state, weekKey, count, sessions, checkins }) => ({
        _id: { state, weekKey },
        count,
        sessions,
        checkins,
      }));

    return jsonOk({
      currentWeekKey: weekKey,
      totalMentors,
      activeMentors,
      reportsThisWeek,
      openAlerts,
      submissionRate: activeMentors > 0 ? reportsThisWeek / activeMentors : 0,
      rollups: latestRollups,
      submissionsByState,
      totalFellows,
    });
  } catch (err: any) {
    console.error("Dashboard API Error:", err);
    return jsonError(`Dashboard Server Error: ${err.message}`, 500);
  }
}

/**
 * Build zone-scoped rollup data from WeeklyReports for coordinators / desk officers.
 * Instead of returning global WeeklyRollup records, this aggregates data only from
 * the reports belonging to the user's scoped set of mentors.
 */
async function buildZoneScopedRollups(mentorDocIds: string[], scopedMentorCount: number, fromWeekKey?: string, toWeekKey?: string) {
  if (mentorDocIds.length === 0) return [];

  const mentorObjectIds = mentorDocIds.map(id => new mongoose.Types.ObjectId(id));

  const matchStage: any = { mentor: { $in: mentorObjectIds } };
  if (fromWeekKey || toWeekKey) {
    matchStage.weekKey = {};
    if (fromWeekKey) matchStage.weekKey.$gte = fromWeekKey;
    if (toWeekKey) matchStage.weekKey.$lte = toWeekKey;
  }
  const hasDateRange = !!(fromWeekKey || toWeekKey);

  const rawRollups = await WeeklyReport.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: "mentors",
        localField: "mentor",
        foreignField: "_id",
        as: "mentorData",
      },
    },
    { $unwind: { path: "$mentorData", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$weekKey",
        reportsSubmitted: { $sum: 1 },
        totalSessions: { $sum: "$sessionsCount" },
        totalCheckins: { $sum: "$menteesCheckedIn" },
        urgentAlertsCount: { $sum: { $cond: ["$urgentAlert", 1, 0] } },
        allChallenges: { $push: "$challenges" },
        allStates: { $push: "$mentorData.states" },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: hasDateRange ? 52 : 12 },
  ]);

  return rawRollups.map(r => {
    // Flatten challenges (array of arrays) and compute top 5 by frequency
    const challengeFreq: Record<string, number> = {};
    for (const arr of r.allChallenges) {
      for (const ch of arr) {
        challengeFreq[ch] = (challengeFreq[ch] || 0) + 1;
      }
    }
    const topChallenges = Object.entries(challengeFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Flatten states (array of arrays) and compute top 5 by frequency
    const stateFreq: Record<string, number> = {};
    for (const arr of r.allStates) {
      if (Array.isArray(arr)) {
        for (const s of arr) {
          if (s) stateFreq[s] = (stateFreq[s] || 0) + 1;
        }
      }
    }
    const topStates = Object.entries(stateFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      weekKey: r._id,
      reportsSubmitted: r.reportsSubmitted,
      expectedReports: scopedMentorCount,
      submissionRate: scopedMentorCount > 0 ? r.reportsSubmitted / scopedMentorCount : 0,
      totalSessions: r.totalSessions,
      totalCheckins: r.totalCheckins,
      urgentAlertsCount: r.urgentAlertsCount,
      topChallenges,
      topStates,
      generatedAt: new Date(),
    };
  });
}
