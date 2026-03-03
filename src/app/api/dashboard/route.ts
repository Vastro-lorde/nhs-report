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
        const mentors = await Mentor.find({ state: { $in: deskOfficer.states } }).lean();
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

    // For submissionsByState
    const aggregateMatch: any = {};
    if (mentorDocIds) {
      // Need to convert string array to ObjectIds if using $in with ObjectIds in aggregate
      // But we can just rely on the $lookup and match after, or match WeeklyReport.mentor first
      // Assuming WeeklyReport.mentor stores the Mentor document ObjectId
      // Actually we'll just not filter the starting stage if it's too complex, wait, 
      // easiest is to add a $match stage right at the beginning.
    }

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
      user.role === UserRole.ADMIN || user.role === UserRole.COORDINATOR || user.role === UserRole.ZONAL_DESK_OFFICER ? WeeklyRollup.find().sort({ weekKey: -1 }).limit(12).lean() : Promise.resolve([]),
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
          from: "mentors", // wait, mentor.state is in Mentor collection now, not User collection!
          localField: "mentor",
          foreignField: "_id", // If "mentor" field on WeeklyReport is Mentor model _id, we need to lookup in "mentors" collection!
          as: "mentorData",
        },
      },
      { $unwind: "$mentorData" },
      {
        $group: {
          _id: { state: "$mentorData.state", weekKey: "$weekKey" },
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
