/* ──────────────────────────────────────────
   Dashboard page — executive summary
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout";
import { ScoreCard, Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { api, type DashboardData, type Mentor, type Fellow } from "@/lib/api-client";
import { Users, FileText, AlertTriangle, BarChart3, UserCheck, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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
  const canExportPDF = isDeskOfficer || isMEOfficer;
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("dashboard-export-area");
      if (!element) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await html2canvas(element, { scale: 2 } as any);
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

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

function MentorDashboard() {
  const { data: session } = useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<Mentor | null>(null);
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.mentors.get("me"),
      api.fellows.list()
    ])
      .then(([profileData, fellowsData]) => {
        setProfile(profileData);
        setFellows(fellowsData.data);
      })
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
                <UserCheck className="h-5 w-5 text-green-700" />
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

                <div className="w-full mt-6 bg-gray-50 rounded-lg p-4 border grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-700">
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
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "mentor") {
      api.dashboard
        .get()
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
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
