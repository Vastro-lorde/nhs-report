/* ──────────────────────────────────────────
   Dashboard page — executive summary
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { ScoreCard, Card, CardHeader, CardTitle, CardContent, Button, SearchableSelect, Select, Badge } from "@/components/ui";
import { api, type DashboardData, type Mentor, type Fellow, type Report, type RollupItem, type BookingItem } from "@/lib/api-client";
import { Users, FileText, AlertTriangle, BarChart3, UserCheck, Download, Trophy, GraduationCap, Clock, Calendar, BookOpen, AlertCircle } from "lucide-react";
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
import { weekRangeFilenameCodeFromWeekKey, weekRangeLabelFromWeekKey, formatDate } from "@/lib/date-helpers";

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ScoreCard
            title="Active Mentors"
            value={data.activeMentors}
            subtitle={`${data.totalMentors} total`}
            icon={Users}
          />
          <ScoreCard
            title="Total Fellows"
            value={data.totalFellows}
            icon={GraduationCap}
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

        {/* Mentor Sessions Tool */}
        <MentorSessionsTool currentWeekKey={data.currentWeekKey} rollups={data.rollups} />
      </div>
    </>
  );
}

function MentorSessionsTool({ currentWeekKey, rollups }: { currentWeekKey: string; rollups: RollupItem[] }) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [selectedMentorId, setSelectedMentorId] = useState<string>("");
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(currentWeekKey);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMentors = useCallback(async (query?: string) => {
    setMentorLoading(true);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (query) params.search = query;
      const res = await api.mentors.list(params);
      setMentors(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setMentorLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMentors();
  }, [loadMentors]);

  const onMentorSearch = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadMentors(query), 300);
  };

  useEffect(() => {
    if (!selectedMentorId || !selectedWeekKey) {
      setReport(null);
      setHasFetched(false);
      return;
    }
    setLoading(true);
    api.reports
      .list({ mentorId: selectedMentorId, weekKey: selectedWeekKey })
      .then((res) => {
        setReport(res.data[0] || null);
        setHasFetched(true);
      })
      .catch((err) => {
        console.error("Failed to fetch report:", err);
        setReport(null);
        setHasFetched(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedMentorId, selectedWeekKey]);

  const mentorOptions = useMemo(() => {
    return mentors
      .filter((m) => m.mentorId)
      .map((m) => ({
        value: m.mentorId!,
        label: `${m.name} (${m.states?.join(", ") || "No State"})`,
      }));
  }, [mentors]);

  const weekOptions = useMemo(() => {
    return rollups.map((r) => ({
      value: r.weekKey,
      label: `Week ending ${weekRangeLabelFromWeekKey(r.weekKey)}`,
    }));
  }, [rollups]);

  const currentMentor = selectedMentor;

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-gray-100">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-orange-700" />
          Mentorship Sessions & Mentor Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <SearchableSelect
            label="Select Mentor"
            placeholder="Search by mentor name..."
            options={mentorOptions}
            value={selectedMentorId}
            selectedLabel={
              selectedMentor
                ? `${selectedMentor.name} (${selectedMentor.states?.join(", ") || "No State"})`
                : undefined
            }
            loading={mentorLoading}
            onSearch={onMentorSearch}
            onChange={(v) => {
              setSelectedMentorId(v);
              setSelectedMentor(mentors.find((m) => m.mentorId === v) ?? null);
            }}
          />
          <Select
            label="Select Week"
            options={weekOptions}
            value={selectedWeekKey}
            onChange={(e) => setSelectedWeekKey(e.target.value)}
          />
        </div>

        {!selectedMentorId ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              Please select a mentor to view their mentorship sessions and statistics for the selected week.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700" />
            <p className="text-sm text-gray-500">Fetching session data...</p>
          </div>
        ) : hasFetched && !report ? (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800">No report submitted</h4>
                <p className="text-sm text-yellow-700 mt-0.5">
                  This mentor has not submitted a weekly report for the week ending{" "}
                  {weekRangeLabelFromWeekKey(selectedWeekKey)}.
                </p>
              </div>
            </div>

            {currentMentor && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Mentor Information
                </h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-400">Email Address</dt>
                    <dd className="font-medium text-gray-800 mt-1">{currentMentor.email}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Phone Number</dt>
                    <dd className="font-medium text-gray-800 mt-1">{currentMentor.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">States Assigned</dt>
                    <dd className="font-medium text-gray-800 mt-1">
                      {currentMentor.states?.join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">LGAs Assigned</dt>
                    <dd className="font-medium text-gray-800 mt-1">
                      {currentMentor.lgas?.join(", ") || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        ) : report ? (
          <div className="space-y-6">
            {/* Stats Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="bg-white p-3 rounded-lg border border-gray-200/50 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Report Status
                </span>
                <div className="mt-2">
                  <Badge
                    variant={
                      report.status.toLowerCase() === "approved"
                        ? "default"
                        : report.status.toLowerCase() === "draft"
                        ? "secondary"
                        : "info"
                    }
                  >
                    {report.status}
                  </Badge>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200/50 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Total Sessions Held
                </span>
                <span className="text-2xl font-bold text-gray-800 mt-1">{report.sessionsCount}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200/50 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Mentees Checked In
                </span>
                <span className="text-2xl font-bold text-gray-800 mt-1">{report.menteesCheckedIn}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200/50 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Urgent Alerts
                </span>
                <div className="mt-2">
                  {report.urgentAlert ? (
                    <Badge variant="destructive">Urgent Alert Raised</Badge>
                  ) : (
                    <Badge variant="secondary">No Alerts</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Weekly Overview Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
              {report.keyWins && (
                <div className="border border-gray-100 rounded-lg p-4 bg-orange-50/20">
                  <h4 className="font-semibold text-orange-900 text-sm mb-1">Key Wins</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.keyWins}</p>
                </div>
              )}
              {report.supportNeeded && (
                <div className="border border-gray-100 rounded-lg p-4 bg-blue-50/20">
                  <h4 className="font-semibold text-blue-900 text-sm mb-1">Support Needed</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.supportNeeded}</p>
                </div>
              )}
            </div>

            {/* Challenges Section */}
            {report.challenges && report.challenges.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 bg-red-50/10">
                <h4 className="font-semibold text-red-900 text-sm mb-2">Challenges Encountered</h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {report.challenges.map((c, idx) => (
                    <Badge key={idx} variant="warning">
                      {c}
                    </Badge>
                  ))}
                </div>
                {report.challengeDescription && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.challengeDescription}</p>
                )}
              </div>
            )}

            {/* Urgent Alert Details */}
            {report.urgentAlert && report.urgentDetails && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-750 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900">Urgent Alert Details</h4>
                  <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{report.urgentDetails}</p>
                </div>
              </div>
            )}

            {/* Mentorship Sessions List */}
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-700" />
                Mentorship Sessions ({report.sessions?.length || 0})
              </h3>
              {!report.sessions || report.sessions.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4">
                  No detailed session records provided in the report.
                </p>
              ) : (
                <div className="space-y-4">
                  {report.sessions.map((s, idx) => (
                    <div
                      key={s._id || idx}
                      className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-md transition duration-150"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
                        <div>
                          <h4 className="font-bold text-gray-800 text-base">{s.menteeName}</h4>
                          {s.menteeLGA && (
                            <p className="text-xs text-gray-500 font-medium uppercase mt-0.5">
                              LGA: {s.menteeLGA}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {s.sessionDate ? formatDate(s.sessionDate) : "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {s.startTime} - {s.endTime} ({s.duration})
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            Topic Discussed
                          </h5>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.topicDiscussed}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {s.challenges && s.challenges.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                Challenges
                              </h5>
                              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                {s.challenges.map((ch, cidx) => (
                                  <li key={cidx}>{ch}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {s.solutions && s.solutions.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                Solutions
                              </h5>
                              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                {s.solutions.map((sol, sidx) => (
                                  <li key={sidx}>{sol}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {s.actionPlan && s.actionPlan.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                Action Plan
                              </h5>
                              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                {s.actionPlan.map((act, aidx) => (
                                  <li key={aidx}>{act}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
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

function FellowDashboard() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.bookings
      .list({ upcoming: "true", status: "confirmed" })
      .then((res) => setBookings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "Africa/Lagos",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <>
      <Header title="Dashboard" subtitle="Your mentorship sessions at a glance" />
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Book a mentorship session</h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose from your mentor&apos;s available time slots.
              </p>
            </div>
            <Link href="/book">
              <Button>Book a Session</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No upcoming sessions. Book one to get started.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {bookings.map((b) => (
                  <li key={b._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{fmt(b.startAt)}</p>
                      {b.note && <p className="text-xs text-gray-500 mt-0.5">Note: {b.note}</p>}
                    </div>
                    {b.meetingLink && (
                      <a
                        href={b.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-orange-700 hover:underline"
                      >
                        Join
                      </a>
                    )}
                  </li>
                ))}
              </ul>
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
  const isFellow = user?.role === "fellow";

  useEffect(() => {
    if (status === "loading") return;
    if (isMentor || isFellow) return;
    api.dashboard
      .get()
      .then(setData)
      .catch(console.error)
      .finally(() => setFetched(true));
  }, [status, isMentor, isFellow]);

  const loading = status === "loading" || (!isMentor && !isFellow && !fetched);

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

  if (user?.role === "fellow") {
    return <FellowDashboard />;
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
