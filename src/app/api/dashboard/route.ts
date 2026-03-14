/* ──────────────────────────────────────────
   API: /api/dashboard — aggregated stats for dashboard
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, User, Alert, WeeklyRollup, Mentor, Coordinator, DeskOfficer } from "@/models";
import mongoose from "mongoose";
import { UserRole, AlertStatus } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { currentWeekKey } from "@/lib/date-helpers";

export async function GET(_request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const user = session!.user;

    await connectDB();

    const weekKey = currentWeekKey();

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

    const alertFilter: any = { status: { $ne: AlertStatus.RESOLVED } };
    // Note: Alert schema uses User ID for mentor field.
    if (mentorAuthIds) alertFilter.mentor = { $in: mentorAuthIds };

    const isZoneScoped = user.role === UserRole.COORDINATOR || user.role === UserRole.ZONAL_DESK_OFFICER;

    const [
      totalMentors,
      activeMentors,
      reportsThisWeek,
      openAlerts,
      latestRollups,
    ] = await Promise.all([
      User.countDocuments(baseMentorFilter),
      User.countDocuments(activeMentorFilter),
      WeeklyReport.countDocuments(reportFilter),
      Alert.countDocuments(alertFilter),
      // Admins, ME Officers & Team Research Leads get pre-computed global rollups; zone-scoped roles get zone-scoped rollups
      user.role === UserRole.ADMIN || user.role === UserRole.ME_OFFICER || user.role === UserRole.TEAM_RESEARCH_LEAD
        ? WeeklyRollup.find().sort({ weekKey: -1 }).limit(12).lean()
        : isZoneScoped
          ? buildZoneScopedRollups(mentorDocIds ?? [], mentorDocIds?.length ?? 0)
          : Promise.resolve([]),
    ]);

    // Aggregate submissions by state
    const aggregatePipeline: any[] = [];
    if (mentorDocIds) {
      aggregatePipeline.push({
        $match: { mentor: { $in: mentorDocIds.map((id: string) => new mongoose.Types.ObjectId(id)) } }
      });
    }

    aggregatePipeline.push(
      {
        $lookup: {
          from: "mentors",
          localField: "mentor",
          foreignField: "_id",
          as: "mentorData",
        },
      },
      { $unwind: "$mentorData" },
      { $unwind: { path: "$mentorData.states", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { state: "$mentorData.states", weekKey: "$weekKey" },
          count: { $sum: 1 },
          sessions: { $sum: "$sessionsCount" },
          checkins: { $sum: "$menteesCheckedIn" },
        },
      },
      { $sort: { "_id.weekKey": -1 } },
      { $limit: 200 }
    );

    const submissionsByState = await WeeklyReport.aggregate(aggregatePipeline);

    return jsonOk({
      currentWeekKey: weekKey,
      totalMentors,
      activeMentors,
      reportsThisWeek,
      openAlerts,
      submissionRate: activeMentors > 0 ? reportsThisWeek / activeMentors : 0,
      rollups: latestRollups,
      submissionsByState,
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
async function buildZoneScopedRollups(mentorDocIds: string[], scopedMentorCount: number) {
  if (mentorDocIds.length === 0) return [];

  const mentorObjectIds = mentorDocIds.map(id => new mongoose.Types.ObjectId(id));

  const rawRollups = await WeeklyReport.aggregate([
    { $match: { mentor: { $in: mentorObjectIds } } },
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
    { $limit: 12 },
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
