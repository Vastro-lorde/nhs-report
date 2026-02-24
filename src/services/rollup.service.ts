/* ──────────────────────────────────────────
   Rollup service — builds aggregated weekly data
   Single source of truth for rollup logic
   ────────────────────────────────────────── */
import { connectDB } from "@/lib/db";
import { WeeklyReport, WeeklyRollup, User, Alert } from "@/models";

export async function rebuildRollupForWeek(weekKey: string) {
  await connectDB();

  // Count active mentors
  const expectedReports = await User.countDocuments({
    role: "mentor",
    active: true,
  });

  // Aggregate report data for the week
  const reports = await WeeklyReport.find({ weekKey }).populate("mentor", "state");

  const submitted = reports.length;
  let totalSessions = 0;
  let totalCheckins = 0;
  let urgentCount = 0;
  const challengeFreq: Record<string, number> = {};
  const stateFreq: Record<string, number> = {};

  for (const r of reports) {
    totalSessions += r.sessions?.length || r.sessionsCount;
    totalCheckins += r.menteesCheckedIn;
    if (r.urgentAlert) urgentCount++;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (r.mentor as any)?.state;
    if (state) stateFreq[state] = (stateFreq[state] || 0) + 1;

    for (const ch of r.challenges) {
      challengeFreq[ch] = (challengeFreq[ch] || 0) + 1;
    }
  }

  const topChallenges = topN(challengeFreq, 5);
  const topStates = topN(stateFreq, 5);

  const submissionRate = expectedReports > 0 ? submitted / expectedReports : 0;

  await WeeklyRollup.findOneAndUpdate(
    { weekKey },
    {
      weekKey,
      reportsSubmitted: submitted,
      expectedReports,
      submissionRate,
      totalSessions,
      totalCheckins,
      urgentAlertsCount: urgentCount,
      topChallenges,
      topStates,
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

export async function rebuildAllRollups() {
  await connectDB();
  const weekKeys = await WeeklyReport.distinct("weekKey");
  for (const wk of weekKeys) {
    await rebuildRollupForWeek(wk);
  }
}

/** Get existing rollup for a week */
export async function getRollup(weekKey: string) {
  await connectDB();
  return WeeklyRollup.findOne({ weekKey }).lean();
}

/** Get latest N rollups (for dashboard) */
export async function getRecentRollups(limit = 12) {
  await connectDB();
  return WeeklyRollup.find().sort({ weekKey: -1 }).limit(limit).lean();
}

/** Get urgent alerts for digest */
export async function getAlertsForWeek(weekKey: string) {
  await connectDB();
  return Alert.find({ weekKey }).populate("mentor", "name state").lean();
}

// ─── Helper ─────────────────────────────────
function topN(freq: Record<string, number>, n: number) {
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}
