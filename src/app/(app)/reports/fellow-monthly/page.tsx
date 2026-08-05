/* ──────────────────────────────────────────
   Fellow Monthly Reports – List Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { api, type MentorMonthlyReport } from "@/lib/api-client";
import { UserRole, STATES } from "@/lib/constants";
import { safeFormatISO } from "@/lib/date-helpers";
import { Eye, FilePen, FileText, Plus, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";

const RATING_COLORS: Record<string, string> = {
  Excellent: "bg-green-100 text-green-800",
  Good: "bg-blue-100 text-blue-800",
  Fair: "bg-yellow-100 text-yellow-800",
  "Needs Improvement": "bg-red-100 text-red-800",
};


/* ─── Drafts Modal ──────────────────────────
   Mentors' unsubmitted reports. Drafts are excluded from the main listing (and
   from every roll-up), so this is the only way back to them.
   ────────────────────────────────────────── */
function DraftsModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [drafts, setDrafts] = useState<MentorMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.reports.fellowMonthly.list({ status: "draft", limit: "100" });
      setDrafts(result.data);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load drafts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const handleDelete = async (id: string) => {
    if (!window.confirm("Discard this draft? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.reports.fellowMonthly.delete(id);
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message ?? "Failed to delete draft.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Draft Reports</h2>
            <p className="text-sm text-gray-500">
              Saved but not yet submitted. They are not counted in any report until you submit them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close drafts"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading drafts…</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              You have no draft reports.
            </p>
          ) : (
            <ul className="divide-y">
              {drafts.map((d) => (
                <li key={d._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{d.fellowName}</p>
                    <p className="text-xs text-gray-500">
                      {safeFormatISO(`${d.month}-01`, "MMMM yyyy")}
                      {d.fellowLGA ? ` · ${d.fellowLGA}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/reports/fellow-monthly/${d._id}/edit`}>
                      <Button size="sm" onClick={onClose}>
                        Continue
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deletingId === d._id}
                      onClick={() => handleDelete(d._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-6 py-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MentorMonthlyReportsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canCreate = userRole === UserRole.MENTOR;
  const canDelete = userRole === UserRole.MENTOR || userRole === UserRole.ADMIN;

  const [reports, setReports] = useState<MentorMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [stateFilter, setStateFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [scopedStates, setScopedStates] = useState<string[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  // Debounce name input so we don't refetch on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName(nameFilter.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [nameFilter]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(pageSize) };
      if (stateFilter) params.state = stateFilter;
      if (debouncedName) params.q = debouncedName;
      const result = await api.reports.fellowMonthly.list(params);
      setReports(result.data);
      setPagination(result.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, stateFilter, debouncedName]);

  // Fetch the states the current user is allowed to see
  useEffect(() => {
    async function fetchScopedStates() {
      const role = session?.user?.role;
      if (role !== UserRole.COORDINATOR && role !== UserRole.ZONAL_DESK_OFFICER) {
        setScopedStates([]);
        return;
      }
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        const states = (data?.roleDetails?.states ?? []) as string[];
        const cleaned = Array.from(
          new Set(states.map((s) => String(s).toUpperCase().trim()).filter(Boolean)),
        );
        setScopedStates(cleaned);
      } catch {
        // no-op
      }
    }
    fetchScopedStates();
  }, [session?.user?.role]);

  // Badge on the Drafts button, so an unfinished report is visible without
  // opening the modal.
  const fetchDraftCount = useCallback(async () => {
    if (!canCreate) return;
    try {
      const result = await api.reports.fellowMonthly.list({ status: "draft", limit: "1" });
      setDraftCount(result.pagination.total);
    } catch {
      // non-critical
    }
  }, [canCreate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchDraftCount();
  }, [fetchDraftCount]);

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
                {pagination.total} report{pagination.total === 1 ? "" : "s"}
              </div>
              <Input
                type="search"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Search fellow name…"
                className="w-full sm:w-56"
              />
              {userRole !== UserRole.MENTOR && (
                <Select
                  value={stateFilter}
                  onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
                  options={[
                    { label: "All States", value: "" },
                    ...(
                      userRole === UserRole.COORDINATOR || userRole === UserRole.ZONAL_DESK_OFFICER
                        ? scopedStates
                        : STATES
                    ).map((s) => ({ label: s, value: s })),
                  ]}
                  className="w-full sm:w-48"
                />
              )}
            </div>
            {canCreate && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowDrafts(true)}>
                  <FilePen className="h-4 w-4 mr-1" />
                  Drafts
                  {draftCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-orange-100 text-orange-700 px-1.5 text-xs font-semibold">
                      {draftCount}
                    </span>
                  )}
                </Button>
                <Link href="/reports/fellow-monthly/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" /> New Fellow Monthly Report
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fellow</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">LGA</th>
                <th className="px-4 py-3 font-medium text-gray-600">Attendance</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Progress</th>
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
                reports.map(r => {
                  const displayMonth = safeFormatISO(r.month ? `${r.month}-01` : null, "MMMM yyyy");
                  const attendancePct =
                    r.sessionsHeld > 0
                      ? Math.round((r.sessionsAttended / r.sessionsHeld) * 100)
                      : 0;

                  return (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{displayMonth}</td>
                      <td className="px-4 py-3">{r.fellowName}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{r.fellowLGA}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.sessionsAttended}/{r.sessionsHeld}
                        {r.sessionsHeld > 0 && (
                          <span className="ml-1 text-xs text-gray-400">({attendancePct}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
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

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500 flex-wrap gap-3">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} reports)
            </span>
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
              >
                {[10, 15, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
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
          </div>
        )}
      </div>
      {canCreate && (
        <DraftsModal
          open={showDrafts}
          onClose={() => setShowDrafts(false)}
          onChanged={() => {
            fetchDraftCount();
            fetchReports();
          }}
        />
      )}
    </>
  );
}
