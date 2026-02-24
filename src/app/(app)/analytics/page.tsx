/* ──────────────────────────────────────────
   Analytics Page  —  deeper trend charts
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { api, type DashboardData } from "@/lib/api-client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  type PieLabelRenderProps,
} from "recharts";

const COLORS = [
  "#16a34a", "#2563eb", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d",
];

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  useEffect(() => {
    api.dashboard
      .get()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading analytics…
      </div>
    );

  if (!data) return null;

  const rollups = data.rollups ?? [];
  const rawByState = data.submissionsByState ?? [];
  
  // Aggregate the submissionsByState (which may be per-state-per-week) into just per-state totals
  const stateMap: Record<string, number> = {};
  rawByState.forEach((s) => {
    const stateName = typeof s._id === "string" ? s._id : s._id?.state ?? "Unknown";
    stateMap[stateName] = (stateMap[stateName] || 0) + s.count;
  });
  const byState = Object.entries(stateMap)
    .map(([_id, count]) => ({ _id, count }))
    .sort((a, b) => b.count - a.count);

  // Prepare challenge aggregation from rollups
  const challengeMap: Record<string, number> = {};
  rollups.forEach((r) => {
    r.topChallenges?.forEach((c: { name: string; count: number }) => {
      challengeMap[c.name] = (challengeMap[c.name] || 0) + c.count;
    });
  });
  const challengeData = Object.entries(challengeMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <>
      <Header title="Analytics" subtitle="Deep-dive into reporting trends" />

      <div className="p-6 space-y-6">
        {/* Toggle */}
        <Select
          label="Trend Chart Type"
          value={chartType}
          onChange={(e) => setChartType(e.target.value as "line" | "bar")}
          options={[
            { label: "Line Chart", value: "line" },
            { label: "Bar Chart", value: "bar" },
          ]}
          className="w-48"
        />

        {/* Submission Rate + Sessions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Rate & Sessions Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              {chartType === "line" ? (
                <LineChart data={rollups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekKey" fontSize={12} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="submissionRate"
                    stroke="#16a34a"
                    name="Submission Rate %"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalSessions"
                    stroke="#2563eb"
                    name="Total Sessions"
                    strokeWidth={2}
                  />
                </LineChart>
              ) : (
                <BarChart data={rollups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekKey" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="reportsSubmitted" fill="#16a34a" name="Reports Submitted" />
                  <Bar dataKey="totalSessions" fill="#2563eb" name="Sessions" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Reports by State */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports by State</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byState} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="_id" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Challenge Distribution (Pie) */}
          <Card>
            <CardHeader>
              <CardTitle>Challenge Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {challengeData.length ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={challengeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={(props: PieLabelRenderProps) => {
                        const name = String(props.name ?? "");
                        const pct = ((Number(props.percent) || 0) * 100).toFixed(0);
                        return `${name}: ${pct}%`;
                      }}
                      labelLine
                    >
                      {challengeData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">
                  No challenge data available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Urgent Alerts Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rollups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekKey" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="urgentAlertsCount" fill="#dc2626" name="Urgent Alerts" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* State-level table */}
        <Card>
          <CardHeader>
            <CardTitle>State Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">State</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byState.map((s: { _id: string; count: number }) => (
                    <tr key={s._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{s._id}</td>
                      <td className="px-4 py-2">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
