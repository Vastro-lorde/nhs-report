/* ──────────────────────────────────────────
   Analytics Page  —  deeper trend charts
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import { api, type DashboardData } from "@/lib/api-client";
import { exportToCSV } from "@/lib/export";
import { weekRangeLabelFromWeekKey, weekRangeFilenameCodeFromWeekKey } from "@/lib/date-helpers";
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
  "#16a34a", "#2563eb", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d",
];

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.dashboard
      .get()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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

      // Handle multi-page if content is taller than one page
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
                    stroke="#16a34a"
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
                  <Bar dataKey="reportsSubmitted" fill="#16a34a" name="Reports" />
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
                <BarChart data={byState} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickMargin={5} />
                  <YAxis dataKey="_id" type="category" width={80} fontSize={10} tickMargin={5} />
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

        {/* State-level table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>State Performance Summary</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                const exportData = byState.map((s: { _id: string; count: number }) => ({
                  State: s._id,
                  Reports: s.count
                }));
                exportToCSV(exportData, "state-performance");
              }}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
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
