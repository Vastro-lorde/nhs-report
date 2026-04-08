/* ──────────────────────────────────────────
   Analytics Page  —  deeper trend charts
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Download } from "lucide-react";
import { api, type DashboardData, type AnalyticsData } from "@/lib/api-client";
import { exportToCSV } from "@/lib/export";
import { weekRangeLabelFromWeekKey, weekRangeFilenameCodeFromWeekKey } from "@/lib/date-helpers";
import { startOfISOWeek, endOfISOWeek } from "@/lib/date-helpers";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
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
  "#ea580c", "#2563eb", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d",
  "#059669", "#6366f1", "#f59e0b", "#ef4444",
  "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4",
];

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  // Default date range: current ISO week (Mon–Sun)
  const defaultFrom = useMemo(() => toDateString(startOfISOWeek(new Date())), []);
  const defaultTo = useMemo(() => toDateString(endOfISOWeek(new Date())), []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [data, setData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback((from: string, to: string) => {
    setLoading(true);
    const params = { from, to };
    Promise.all([api.dashboard.get(params), api.analytics.get(params)])
      .then(([dashData, anData]) => {
        setData(dashData);
        setAnalyticsData(anData);
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(defaultFrom, defaultTo);
  }, [fetchData, defaultFrom, defaultTo]);

  const handleDateChange = () => {
    if (dateFrom && dateTo) fetchData(dateFrom, dateTo);
  };

  const setPresetRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const f = toDateString(startOfISOWeek(from));
    const t = toDateString(endOfISOWeek(to));
    setDateFrom(f);
    setDateTo(t);
    fetchData(f, t);
  };

  const resetToCurrentWeek = () => {
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
    fetchData(defaultFrom, defaultTo);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("analytics-export-area");
      if (!element) return;

      const imgData = await toPng(element, { pixelRatio: 2 });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load generated image for PDF export"));
        img.src = imgData;
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.naturalHeight * pdfWidth) / img.naturalWidth;

      const pageHeight = pdf.internal.pageSize.getHeight();
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      } else {
        let position = 0;
        let remaining = pdfHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
          remaining -= pageHeight;
          position -= pageHeight;
          if (remaining > 0) pdf.addPage();
        }
      }

      const weekCode = data?.currentWeekKey ? weekRangeFilenameCodeFromWeekKey(data.currentWeekKey) : "export";
      pdf.save(`Analytics_Export_Week_${weekCode}.pdf`);
    } catch (error) {
      console.error("Failed to export analytics:", error);
      alert("Failed to export analytics as PDF.");
    } finally {
      setExporting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading analytics…
      </div>
    );

  if (!data) return null;

  const rollups = data.rollups ?? [];
  const rawByState = data.submissionsByState ?? [];

  // Aggregate the submissionsByState into per-state totals
  const stateMap: Record<string, number> = {};
  rawByState.forEach((s) => {
    const stateName = typeof s._id === "string" ? s._id : s._id?.state ?? "Unknown";
    stateMap[stateName] = (stateMap[stateName] || 0) + s.count;
  });
  const byState = Object.entries(stateMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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

  // Analytics data
  const fellowsByState = analyticsData?.fellowsByState ?? [];
  const fellowsByGender = analyticsData?.fellowsByGender?.map(g => ({ name: g.gender, value: g.count })) ?? [];
  const mentorsByState = analyticsData?.mentorsByState ?? [];
  const qualifications = analyticsData?.qualifications?.map(q => ({ name: q.name, value: q.count })) ?? [];

  // Combined distribution by state for fellows & mentors
  const allStates = new Set([
    ...fellowsByState.map(f => f.state),
    ...mentorsByState.map(m => m.state),
  ]);
  const distributionByState = Array.from(allStates)
    .map(state => ({
      state,
      fellows: fellowsByState.find(f => f.state === state)?.count ?? 0,
      mentors: mentorsByState.find(m => m.state === state)?.count ?? 0,
    }))
    .sort((a, b) => (b.fellows + b.mentors) - (a.fellows + a.mentors));

  const renderPieLabel = (props: PieLabelRenderProps) => {
    const name = String(props.name ?? "");
    const pct = ((Number(props.percent) || 0) * 100).toFixed(0);
    return `${name}: ${pct}%`;
  };

  return (
    <>
      <Header title="Analytics" subtitle="Deep-dive into reporting trends">
        <Button
          onClick={handleExportPDF}
          disabled={exporting}
          size="sm"
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exporting..." : "Export as PDF"}
        </Button>
      </Header>

      <div id="analytics-export-area" className="p-6 space-y-6 bg-gray-50">
        {/* Global controls: Date Range + Chart Type Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full sm:w-44"
              />
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full sm:w-44"
              />
              <Button size="sm" onClick={handleDateChange} disabled={loading}>
                {loading ? "Loading…" : "Apply"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={resetToCurrentWeek}>This Week</Button>
                <Button size="sm" variant="outline" onClick={() => setPresetRange(28)}>Last 4 Weeks</Button>
                <Button size="sm" variant="outline" onClick={() => setPresetRange(90)}>Last 3 Months</Button>
                <Button size="sm" variant="outline" onClick={() => setPresetRange(365)}>Last Year</Button>
              </div>
              <Select
                label="Chart Type"
                value={chartType}
                onChange={(e) => setChartType(e.target.value as "line" | "bar")}
                options={[
                  { label: "Line Chart", value: "line" },
                  { label: "Bar Chart", value: "bar" },
                ]}
                className="w-full sm:w-36"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submission Rate + Sessions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Rate & Sessions Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              {chartType === "line" ? (
                <LineChart data={rollups} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekKey" fontSize={10} tickMargin={8} tickFormatter={weekRangeLabelFromWeekKey} />
                  <YAxis yAxisId="left" width={30} fontSize={10} tickMargin={5} />
                  <YAxis yAxisId="right" orientation="right" width={30} fontSize={10} tickMargin={5} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="submissionRate"
                    stroke="#ea580c"
                    name="Submit %"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalSessions"
                    stroke="#2563eb"
                    name="Sessions"
                    strokeWidth={2}
                  />
                </LineChart>
              ) : (
                <BarChart data={rollups} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekKey" fontSize={10} tickMargin={8} tickFormatter={weekRangeLabelFromWeekKey} />
                  <YAxis width={30} fontSize={10} tickMargin={5} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                  <Bar dataKey="reportsSubmitted" fill="#ea580c" name="Reports" />
                  <Bar dataKey="totalSessions" fill="#2563eb" name="Sessions" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* State Performance Summary (Pie) + Reports by State */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>State Performance Summary</CardTitle>
                <Button variant="outline" size="sm" onClick={() => {
                  const exportData = byState.map(s => ({ State: s.name, Reports: s.value }));
                  exportToCSV(exportData, "state-performance");
                }}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {byState.length ? (
                <ResponsiveContainer width="100%" height={Math.max(400, byState.length * 28)}>
                  <BarChart data={byState} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} tickMargin={5} />
                    <YAxis dataKey="name" type="category" width={70} fontSize={10} tickMargin={5} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ea580c" name="Reports" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No state data available yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Challenge Distribution (Pie) */}
          <Card>
            <CardHeader>
              <CardTitle>Challenge Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {challengeData.length ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={challengeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={renderPieLabel}
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

        {/* Fellows & Mentors Distribution by State */}
        <Card>
          <CardHeader>
            <CardTitle>Fellows & Mentors Distribution by State</CardTitle>
          </CardHeader>
          <CardContent>
            {distributionByState.length ? (
              <ResponsiveContainer width="100%" height={Math.max(350, distributionByState.length * 30)}>
                <BarChart data={distributionByState} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickMargin={5} />
                  <YAxis dataKey="state" type="category" width={70} fontSize={10} tickMargin={5} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="fellows" fill="#ea580c" name="Fellows" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="mentors" fill="#2563eb" name="Mentors" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-12">No distribution data available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Fellows by Gender + Fellow Qualifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Fellows by Gender</CardTitle>
            </CardHeader>
            <CardContent>
              {fellowsByGender.length ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={fellowsByGender}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={renderPieLabel}
                      labelLine
                    >
                      {fellowsByGender.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No gender data available yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fellow Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              {qualifications.length ? (
                <ResponsiveContainer width="100%" height={Math.max(350, qualifications.length * 28)}>
                  <BarChart data={qualifications} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} tickMargin={5} />
                    <YAxis dataKey="name" type="category" width={70} fontSize={10} tickMargin={5} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" name="Fellows" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-12">No qualification data available yet.</p>
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
              <BarChart data={rollups} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekKey" fontSize={10} tickMargin={8} tickFormatter={weekRangeLabelFromWeekKey} />
                <YAxis width={30} fontSize={10} tickMargin={5} />
                <Tooltip />
                <Bar dataKey="urgentAlertsCount" fill="#dc2626" name="Urgent Alerts" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Reports by State (Bar) */}
        <Card>
          <CardHeader>
            <CardTitle>Reports by State</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={byState} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={10} tickMargin={5} />
                <YAxis dataKey="name" type="category" width={60} fontSize={10} tickMargin={5} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                <Tooltip />
                <Bar dataKey="value" fill="#ea580c" name="Reports" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
