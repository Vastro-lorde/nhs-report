/* ──────────────────────────────────────────
   Fellow Monthly Reports – List Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { api, type MentorMonthlyReport } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { safeFormatISO } from "@/lib/date-helpers";
import { Eye, FileText, Plus, Trash2 } from "lucide-react";

const RATING_COLORS: Record<string, string> = {
  Excellent: "bg-green-100 text-green-800",
  Good: "bg-blue-100 text-blue-800",
  Fair: "bg-yellow-100 text-yellow-800",
  "Needs Improvement": "bg-red-100 text-red-800",
};

export default function MentorMonthlyReportsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canCreate = userRole === UserRole.MENTOR;
  const canDelete = userRole === UserRole.MENTOR || userRole === UserRole.ADMIN;

  const [reports, setReports] = useState<MentorMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.reports.fellowMonthly.list({ limit: "100" });
      setReports(result.data);
      setTotal(result.pagination.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Derive unique states from loaded reports
  const availableStates = useMemo(() => {
    const stateSet = new Set<string>();
    reports.forEach((r) => {
      r.mentor?.states?.forEach((s) => stateSet.add(s));
    });
    return Array.from(stateSet).sort();
  }, [reports]);

  // Frontend-only filtered list
  const filteredReports = useMemo(() => {
    if (!stateFilter) return reports;
    return reports.filter((r) => r.mentor?.states?.includes(stateFilter));
  }, [reports, stateFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      await api.reports.fellowMonthly.delete(id);
      fetchReports();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  return (
    <>
      <Header
        title="Fellow Monthly Reports"
        subtitle="Per-fellow monthly progress reports submitted by mentors"
      />

      <div className="p-6 space-y-4">
        <Card>
          <CardContent className="pt-4 flex justify-between items-center flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm text-gray-600">
                {filteredReports.length} of {total} report{total === 1 ? "" : "s"}
              </div>
              {availableStates.length > 1 && (
                <Select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  placeholder="All States"
                  options={availableStates.map((s) => ({ value: s, label: s }))}
                  className="w-48"
                />
              )}
            </div>
            {canCreate && (
              <Link href="/reports/fellow-monthly/new">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> New Fellow Monthly Report
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fellow</th>
                <th className="px-4 py-3 font-medium text-gray-600">LGA</th>
                <th className="px-4 py-3 font-medium text-gray-600">Attendance</th>
                <th className="px-4 py-3 font-medium text-gray-600">Progress</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Loading reports…
                  </td>
                </tr>
              ) : !reports.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex flex-col items-center space-y-2">
                      <FileText className="h-8 w-8 text-gray-300" />
                      <p>No fellow monthly reports found.</p>
                      {canCreate && (
                        <Link href="/reports/fellow-monthly/new">
                          <span className="text-orange-600 hover:underline">
                            Create your first fellow monthly report
                          </span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReports.map(r => {
                  const displayMonth = safeFormatISO(r.month ? `${r.month}-01` : null, "MMMM yyyy");
                  const attendancePct =
                    r.sessionsHeld > 0
                      ? Math.round((r.sessionsAttended / r.sessionsHeld) * 100)
                      : 0;

                  return (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{displayMonth}</td>
                      <td className="px-4 py-3">{r.fellowName}</td>
                      <td className="px-4 py-3 text-gray-600">{r.fellowLGA}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.sessionsAttended}/{r.sessionsHeld}
                        {r.sessionsHeld > 0 && (
                          <span className="ml-1 text-xs text-gray-400">({attendancePct}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.progressRating ? (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RATING_COLORS[r.progressRating] ?? "bg-gray-100 text-gray-700"}`}
                          >
                            {r.progressRating}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/reports/fellow-monthly/${r._id}`}>
                            <Button variant="ghost" size="icon" aria-label="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => handleDelete(r._id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
