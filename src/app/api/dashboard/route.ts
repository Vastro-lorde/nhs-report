/* ──────────────────────────────────────────
   API: /api/dashboard — aggregated stats for dashboard
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WeeklyReport, User, Alert, WeeklyRollup } from "@/models";
import { UserRole, AlertStatus } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk } from "@/lib/api-helpers";
import { currentWeekKey } from "@/lib/date-helpers";

export async function GET(_request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const weekKey = currentWeekKey();

  const [
    totalMentors,
    activeMentors,
    reportsThisWeek,
    openAlerts,
    latestRollups,
    submissionsByState,
  ] = await Promise.all([
    User.countDocuments({ role: UserRole.MENTOR }),
    User.countDocuments({ role: UserRole.MENTOR, active: true }),
    WeeklyReport.countDocuments({ weekKey }),
    Alert.countDocuments({ status: { $ne: AlertStatus.RESOLVED } }),
    WeeklyRollup.find().sort({ weekKey: -1 }).limit(12).lean(),
    WeeklyReport.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "mentor",
          foreignField: "_id",
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
      { $limit: 200 },
    ]),
  ]);

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
}
