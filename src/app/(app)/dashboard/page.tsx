/* ──────────────────────────────────────────
   Dashboard page — executive summary
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout";
import { ScoreCard, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { api, type DashboardData } from "@/lib/api-client";
import { Users, FileText, AlertTriangle, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard
      .get()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Failed to load dashboard data.</p>
      </div>
    );
  }

  const pct = Math.round(data.submissionRate * 100);

  // Prepare chart data from rollups
  const rollupChartData = [...data.rollups]
    .reverse()
    .map((r) => ({
      week: r.weekKey,
      "Submission Rate (%)": Math.round(r.submissionRate * 100),
      Sessions: r.totalSessions,
      "Check-ins": r.totalCheckins,
    }));

  // Top challenges from latest rollup
  const latestRollup = data.rollups[0];
  const challengeData = latestRollup?.topChallenges ?? [];

  // Submissions by state for current week
  const stateData = data.submissionsByState
    .filter((s) => {
      if (typeof s._id === "string") return true;
      return s._id.weekKey === data.currentWeekKey;
    })
    .map((s) => {
      const stateName = typeof s._id === "string" ? s._id : (s._id.state || "Unknown");
      return { state: stateName, reports: s.count, sessions: s.sessions ?? 0 };
    });

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Week ${data.currentWeekKey}`}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ScoreCard
            title="Active Mentors"
            value={data.activeMentors}
            subtitle={`${data.totalMentors} total`}
            icon={Users}
          />
          <ScoreCard
            title="Reports This Week"
            value={data.reportsThisWeek}
            subtitle={`${pct}% submission rate`}
            icon={FileText}
            trend={pct >= 80 ? "up" : pct >= 50 ? "neutral" : "down"}
          />
          <ScoreCard
            title="Open Alerts"
            value={data.openAlerts}
            icon={AlertTriangle}
            trend={data.openAlerts > 0 ? "down" : "up"}
          />
          <ScoreCard
            title="Submission Rate"
            value={`${pct}%`}
            subtitle="this week"
            icon={BarChart3}
            trend={pct >= 80 ? "up" : "down"}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submission Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Submission Rate & Sessions Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {rollupChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={rollupChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" fontSize={12} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="Submission Rate (%)"
                      stroke="#15803d"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Sessions"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Reports by State */}
          <Card>
            <CardHeader>
              <CardTitle>Reports by State (This Week)</CardTitle>
            </CardHeader>
            <CardContent>
              {stateData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stateData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="state" fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="reports" fill="#15803d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Challenges */}
        <Card>
          <CardHeader>
            <CardTitle>Top Challenges (Latest Week)</CardTitle>
          </CardHeader>
          <CardContent>
            {challengeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={challengeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={200} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-8">No challenge data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
