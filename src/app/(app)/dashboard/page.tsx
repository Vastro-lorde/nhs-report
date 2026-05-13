/* ──────────────────────────────────────────
   Dashboard page — executive summary
   ────────────────────────────────────────── */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout";
import { ScoreCard, Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { api, type DashboardData, type Mentor, type Fellow, type Report } from "@/lib/api-client";
import { Users, FileText, AlertTriangle, BarChart3, UserCheck, Download, Trophy } from "lucide-react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
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
import { useSession } from "next-auth/react";
import { weekRangeFilenameCodeFromWeekKey, weekRangeLabelFromWeekKey } from "@/lib/date-helpers";

function AdminDashboard({ data }: { data: DashboardData }) {
  const { data: session } = useSession();
  const isDeskOfficer = session?.user?.role === "zonal_desk_officer";
  const isMEOfficer = session?.user?.role === "me_officer";
  const isTeamResearchLead = session?.user?.role === "team_research_lead";
  const canExportPDF = isDeskOfficer || isMEOfficer || isTeamResearchLead;
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("dashboard-export-area");
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

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Dashboard_Export_Week_${weekRangeFilenameCodeFromWeekKey(data.currentWeekKey)}.pdf`);
    } catch (error) {
      console.error("Failed to export dashboard:", error);
      alert("Failed to export dashboard.");
    } finally {
      setExporting(false);
    }
  };

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
        subtitle={`Week ${weekRangeLabelFromWeekKey(data.currentWeekKey)} Overview`}
      >
        {canExportPDF && (
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
        )}
      </Header>

      <div id="dashboard-export-area" className="p-6 space-y-6 bg-gray-50">
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
                    <XAxis dataKey="week" fontSize={12} tickFormatter={weekRangeLabelFromWeekKey} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="Submission Rate (%)"
                      stroke="#c2410c"
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
                    <Bar dataKey="reports" fill="#c2410c" radius={[4, 4, 0, 0]} />
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
                  <YAxis dataKey="name" type="category" width={120} fontSize={12} tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + '…' : v} />
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

function MentorDashboard() {
  const { data: session } = useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<Mentor | null>(null);
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankingView, setRankingView] = useState<"month" | "overall">("overall");

  useEffect(() => {
    Promise.all([
      api.mentors.get("me"),
      api.fellows.list(),
      api.reports.list({ limit: "100" }),
    ])
      .then(([profileData, fellowsData, reportsData]) => {
        setProfile(profileData);
        setFellows(fellowsData.data);
        setReports(reportsData.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const rankingData = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const counts = new Map<string, { name: string; sessions: number }>();

    // Seed with assigned fellows so they appear even with 0 sessions
    for (const f of fellows) {
      const key = f.name?.trim().toLowerCase();
      if (!key) continue;
      counts.set(key, { name: f.name.trim(), sessions: 0 });
    }

    for (const r of reports) {
      for (const s of r.sessions ?? []) {
        if (!s.menteeName) continue;
        if (rankingView === "month") {
          const d = s.sessionDate ? new Date(s.sessionDate) : null;
          if (!d || isNaN(d.getTime())) continue;
          if (d < startOfMonth || d >= startOfNextMonth) continue;
        }
        const key = s.menteeName.trim().toLowerCase();
        if (!key) continue;
        const existing = counts.get(key);
        if (existing) {
          existing.sessions += 1;
        } else {
          counts.set(key, { name: s.menteeName.trim(), sessions: 1 });
        }
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);
  }, [reports, fellows, rankingView]);

  const hasAnySessions = rankingData.some((d) => d.sessions > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Failed to load profile data.</p>
      </div>
    );
  }

  return (
    <>
      <Header
        title={`Welcome, ${user?.name}`}
        subtitle="Mentor Dashboard"
      />

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-orange-700" />
                My Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mt-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase">Full Name</p>
                  <p className="text-sm font-medium">{profile.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase">Email Address</p>
                  <p className="text-sm font-medium">{profile.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase">Phone Number</p>
                  <p className="text-sm font-medium">{profile.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase">State</p>
                  <p className="text-sm font-medium">{profile.states?.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase">Assigned LGAs</p>
                  <p className="text-sm font-medium">{profile.lgas?.join(", ") || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fellows Stats Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-700" />
                My Fellows Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mt-4 flex flex-col items-center justify-center h-full space-y-4 py-6">
                <div className="text-6xl font-bold text-gray-800">{fellows.length}</div>
                <p className="text-gray-500 text-sm uppercase tracking-wider font-medium">Total Fellows Assigned</p>

                <div className="w-full mt-6 bg-gray-50 rounded-lg p-4 border grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-orange-700">
                      {fellows.filter(f => f.gender.toLowerCase() === 'male' || f.gender.toLowerCase() === 'm').length}
                    </p>
                    <p className="text-xs text-gray-500 uppercase mt-1">Male</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">
                      {fellows.filter(f => f.gender.toLowerCase() === 'female' || f.gender.toLowerCase() === 'f').length}
                    </p>
                    <p className="text-xs text-gray-500 uppercase mt-1">Female</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fellow Session Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-orange-700" />
                Fellow Session Ranking
              </CardTitle>
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRankingView("month")}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    rankingView === "month"
                      ? "bg-orange-700 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setRankingView("overall")}
                  className={`px-3 py-1.5 text-xs font-medium transition border-l border-gray-200 ${
                    rankingView === "overall"
                      ? "bg-orange-700 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Overall
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rankingData.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No fellows to rank yet.
              </p>
            ) : !hasAnySessions ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                {rankingView === "month"
                  ? "No sessions recorded this month."
                  : "No sessions recorded yet."}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, rankingData.length * 38)}>
                  <BarChart
                    data={rankingData}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const n = Number(value) || 0;
                        return [`${n} session${n === 1 ? "" : "s"}`, "Sessions"];
                      }}
                    />
                    <Bar dataKey="sessions" fill="#c2410c" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetched, setFetched] = useState(false);
  const isMentor = user?.role === "mentor";

  useEffect(() => {
    if (status === "loading") return;
    if (isMentor) return;
    api.dashboard
      .get()
      .then(setData)
      .catch(console.error)
      .finally(() => setFetched(true));
  }, [status, isMentor]);

  const loading = status === "loading" || (!isMentor && !fetched);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700" />
      </div>
    );
  }

  if (user?.role === "mentor") {
    return <MentorDashboard />;
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Failed to load dashboard data.</p>
      </div>
    );
  }

  return <AdminDashboard data={data} />;
}
