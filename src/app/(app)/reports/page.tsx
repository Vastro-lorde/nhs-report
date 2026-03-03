/* ──────────────────────────────────────────
   Reports List Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type Report } from "@/lib/api-client";
import { STATES, UserRole } from "@/lib/constants";
import { format } from "date-fns";
import { Plus, Eye, ChevronLeft, ChevronRight, FileDown, Download } from "lucide-react";
import dynamic from "next/dynamic";
import { exportToCSV } from "@/lib/export";

const PDFDownloadButton = dynamic(
  () => import("@/components/pdf/PDFDownloadButton").then((m) => m.PDFDownloadButton),
  { ssr: false, loading: () => <span className="text-xs text-gray-400">…</span> }
);

export default function ReportsListPage() {
  const { data: session } = useSession();
  const isMentor = session?.user?.role === UserRole.MENTOR;

  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [weekKey, setWeekKey] = useState("");
  const [state, setState] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "15" };
      if (weekKey) params.weekKey = weekKey;
      if (state) params.state = state;
      const result = await api.reports.list(params);
      setReports(result.data);
      setPagination(result.pagination);
    } catch {
      /* handled by api client */
    } finally {
      setLoading(false);
    }
  }, [page, weekKey, state]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const statusBadge = (status: string) => {
    const variant =
      status === "submitted"
        ? "info"
        : status === "reviewed"
          ? "default"
          : "warning";
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <>
      <Header
        title="Weekly Reports"
        subtitle={isMentor ? "Your submitted reports" : "All mentor reports"}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <Input
                label="Week Key"
                type="week"
                placeholder="2025-W35"
                value={weekKey}
                onChange={(e) => {
                  setWeekKey(e.target.value);
                  setPage(1);
                }}
                className="w-40"
              />
              {!isMentor && (
                <Select
                  label="State"
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: "All States", value: "" },
                    ...STATES.map((s) => ({ label: s, value: s })),
                  ]}
                  className="w-48"
                />
              )}
              {isMentor && (
                <Link href="/reports/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" /> New Report
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                const data = reports.map(r => ({
                  Week: r.weekKey,
                  Mentor: r.mentor?.name ?? r.mentorName ?? "",
                  State: r.mentor?.state ?? r.state,
                  Sessions: r.sessionsCount,
                  Mentees: r.menteesCheckedIn,
                  Status: r.status,
                  Submitted: format(new Date(r.createdAt), "yyyy-MM-dd")
                }));
                exportToCSV(data, "reports");
              }}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Week</th>
                {!isMentor && <th className="px-4 py-3 font-medium text-gray-600">Mentor</th>}
                <th className="px-4 py-3 font-medium text-gray-600">State</th>
                <th className="px-4 py-3 font-medium text-gray-600">Sessions</th>
                <th className="px-4 py-3 font-medium text-gray-600">Mentees</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Submitted</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : !reports.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No reports found.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{report.weekKey}</td>
                    {!isMentor && (
                      <td className="px-4 py-3">{report.mentor?.name ?? report.mentorName ?? "—"}</td>
                    )}
                    <td className="px-4 py-3">{report.mentor?.state ?? report.state}</td>
                    <td className="px-4 py-3">{report.sessionsCount}</td>
                    <td className="px-4 py-3">{report.menteesCheckedIn}</td>
                    <td className="px-4 py-3">{statusBadge(report.status)}</td>
                    <td className="px-4 py-3">
                      {format(new Date(report.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link href={`/reports/${report._id}`}>
                        <Button variant="ghost" size="icon" aria-label="View Report">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <PDFDownloadButton report={report} size="icon" variant="ghost" aria-label="Download PDF">
                        <FileDown className="h-4 w-4" />
                      </PDFDownloadButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} reports)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
