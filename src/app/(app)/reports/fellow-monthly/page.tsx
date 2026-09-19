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
import { Input } from "@/components/ui/Input";
import { api, type MentorMonthlyReport } from "@/lib/api-client";
import { UserRole, STATES } from "@/lib/constants";
import { safeFormatISO, monthKey } from "@/lib/date-helpers";
import { Eye, FilePen, FileText, Plus, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

const RATING_COLORS: Record<string, string> = {
  Excellent: "bg-green-100 text-green-800",
  Good: "bg-blue-100 text-blue-800",
  Fair: "bg-yellow-100 text-yellow-800",
  "Needs Improvement": "bg-red-100 text-red-800",
};

/* ─── Grouping ──────────────────────────────
   Mentors see their reports grouped by month; coordinators and above see
   them grouped by mentor, then by month. Grouping happens within the page
   the API returned, so the server sort must keep groups contiguous.
   ────────────────────────────────────────── */
interface MonthGroup {
  key: string;
  label: string;
  reports: MentorMonthlyReport[];
}

interface MentorGroup {
  key: string;
  mentorId: string;
  label: string;
  count: number;
  months: MonthGroup[];
}

function monthLabel(month: string | undefined) {
  return safeFormatISO(month ? `${month}-01` : null, "MMMM yyyy");
}

function groupReports(reports: MentorMonthlyReport[], byMentor: boolean): MentorGroup[] {
  const mentors = new Map<string, MentorGroup>();
  for (const r of reports) {
    const mentorId = byMentor ? String(r.mentor?._id ?? "unknown") : "all";
    let mentorGroup = mentors.get(mentorId);
    if (!mentorGroup) {
      mentorGroup = {
        key: `mentor:${mentorId}`,
        mentorId,
        label: r.mentor?.authId?.name ?? "Unknown mentor",
        count: 0,
        months: [],
      };
      mentors.set(mentorId, mentorGroup);
    }
    mentorGroup.count += 1;

    const monthKey = `${mentorGroup.key}|${r.month ?? ""}`;
    let monthGroup = mentorGroup.months.find((m) => m.key === monthKey);
    if (!monthGroup) {
      monthGroup = { key: monthKey, label: monthLabel(r.month), reports: [] };
      mentorGroup.months.push(monthGroup);
    }
    monthGroup.reports.push(r);
  }
  return Array.from(mentors.values());
}

function GroupToggle({
  expanded,
  onClick,
  label,
  meta,
  indent = false,
  colSpan,
  tone,
}: {
  expanded: boolean;
  onClick: () => void;
  label: string;
  meta: string;
  indent?: boolean;
  colSpan: number;
  tone: "mentor" | "month";
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <tr className={tone === "mentor" ? "bg-gray-100" : "bg-gray-50"}>
      <td colSpan={colSpan} className="p-0">
        <button
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-200/60 ${indent ? "pl-9" : ""}`}
        >
          <Icon className="h-4 w-4 text-gray-500 shrink-0" />
          <span className={tone === "mentor" ? "font-semibold text-gray-900" : "font-medium text-gray-800"}>
            {label}
          </span>
          <span className="text-xs text-gray-500">{meta}</span>
        </button>
      </td>
    </tr>
  );
}


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
            data-tooltip="Close drafts modal"
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
                    <Link href={`/reports/fellow-monthly/${d._id}/edit`} data-tooltip="Continue editing this draft report">
                      <Button size="sm" onClick={onClose} tooltip="Continue editing this draft report">
                        Continue
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deletingId === d._id}
                      onClick={() => handleDelete(d._id)}
                      tooltip="Discard this draft report"
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
          <Button variant="outline" onClick={onClose} tooltip="Close drafts modal">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MentorMonthlyReportsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role;
  const canCreate = userRole === UserRole.MENTOR;
  const canDelete = userRole === UserRole.MENTOR || userRole === UserRole.ADMIN;
  // Mentors only ever see their own reports, so the mentor level is dropped.
  const groupByMentor = userRole !== UserRole.MENTOR;

  const [reports, setReports] = useState<MentorMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  // Coordinators and above page over mentors so a mentor is never split
  // across pages; mentors themselves page over their own reports.
  const [mentorsPerPage, setMentorsPerPage] = useState(10);
  const [reportTotal, setReportTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
  const [debouncedMentor, setDebouncedMentor] = useState("");
  // Defaults to the current month; future months cannot be selected.
  const currentMonth = monthKey(new Date());
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [scopedStates, setScopedStates] = useState<string[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fellowCounts, setFellowCounts] = useState<Record<string, number>>({});

  // Debounce search inputs so we don't refetch on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName(nameFilter.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [nameFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedMentor(mentorFilter.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [mentorFilter]);

  const fetchReports = useCallback(async () => {
    // The sort depends on the role, so wait until the session is known.
    if (sessionStatus === "loading") return;
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (stateFilter) params.state = stateFilter;
      if (debouncedName) params.q = debouncedName;
      if (groupByMentor) {
        params.sort = "mentor";
        params.mentorsPerPage = String(mentorsPerPage);
        if (debouncedMentor) params.mentorQ = debouncedMentor;
        if (monthFilter) params.month = monthFilter;
      } else {
        params.limit = String(pageSize);
      }
      const result = await api.reports.fellowMonthly.list(params);
      setReports(result.data);
      setPagination(result.pagination);
      setReportTotal(result.totalReports ?? result.pagination.total);
      setFellowCounts(result.mentorFellowCounts ?? {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, mentorsPerPage, stateFilter, debouncedName, debouncedMentor, monthFilter, groupByMentor, sessionStatus]);

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

  const groups = useMemo(() => groupReports(reports, groupByMentor), [reports, groupByMentor]);

  const allGroupKeys = useMemo(
    () => groups.flatMap((g) => [g.key, ...g.months.map((m) => m.key)]),
    [groups],
  );

  // When a page loads, open the first group so the table isn't a wall of
  // collapsed headers; a search opens everything since the user is looking
  // for specific rows.
  const searching = Boolean(debouncedName || debouncedMentor);
  useEffect(() => {
    if (!groups.length) {
      setExpanded(new Set());
      return;
    }
    if (searching) {
      setExpanded(new Set(allGroupKeys));
      return;
    }
    const first = groups[0];
    setExpanded(new Set([first.key, first.months[0]?.key].filter(Boolean) as string[]));
  }, [groups, allGroupKeys, searching]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allExpanded = allGroupKeys.length > 0 && allGroupKeys.every((k) => expanded.has(k));

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      await api.reports.fellowMonthly.delete(id);
      fetchReports();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const columnCount = 5;

  const renderReportRow = (r: MentorMonthlyReport) => {
    const attendancePct =
      r.sessionsHeld > 0 ? Math.round((r.sessionsAttended / r.sessionsHeld) * 100) : 0;

    return (
      <tr key={r._id} className="hover:bg-gray-50">
        <td className={`px-4 py-3 ${groupByMentor ? "pl-14" : "pl-9"}`}>{r.fellowName}</td>
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
            <Link href={`/reports/fellow-monthly/${r._id}`} data-tooltip="View fellow monthly report details">
              <Button variant="ghost" size="icon" aria-label="View" tooltip="View fellow monthly report details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                onClick={() => handleDelete(r._id)}
                tooltip="Delete this fellow monthly report"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Under a mentor, a month reads "5/8 fellows" so gaps in reporting stand
  // out; for mentors themselves it is just the report count.
  const renderMonthGroup = (m: MonthGroup, indent: boolean, fellowTotal?: number) => {
    const open = expanded.has(m.key);
    const meta =
      fellowTotal !== undefined
        ? `${m.reports.length}/${fellowTotal} fellow${fellowTotal === 1 ? "" : "s"} reported`
        : `${m.reports.length} report${m.reports.length === 1 ? "" : "s"}`;
    return [
      <GroupToggle
        key={m.key}
        expanded={open}
        onClick={() => toggle(m.key)}
        label={m.label}
        meta={meta}
        indent={indent}
        colSpan={columnCount}
        tone="month"
      />,
      ...(open ? m.reports.map(renderReportRow) : []),
    ];
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
                {reportTotal} report{reportTotal === 1 ? "" : "s"}
                {groupByMentor && pagination.total > 0 && (
                  <span className="text-gray-400"> · {pagination.total} mentor{pagination.total === 1 ? "" : "s"}</span>
                )}
              </div>
              <Input
                type="search"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Search fellow name…"
                className="w-full sm:w-56"
              />
              {groupByMentor && (
                <>
                  <Input
                    type="search"
                    value={mentorFilter}
                    onChange={(e) => setMentorFilter(e.target.value)}
                    placeholder="Search mentor name…"
                    className="w-full sm:w-56"
                  />
                  <Input
                    type="month"
                    value={monthFilter}
                    max={currentMonth}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Native `max` doesn't stop a typed-in value, so clamp here too.
                      if (value && value > currentMonth) return;
                      setMonthFilter(value);
                      setPage(1);
                    }}
                    aria-label="Filter by month"
                    className="w-full sm:w-44"
                  />
                </>
              )}
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
              {groups.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(allExpanded ? new Set() : new Set(allGroupKeys))}
                  tooltip={allExpanded ? "Collapse every group" : "Expand every group"}
                >
                  {allExpanded ? (
                    <ChevronUp className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  )}
                  {allExpanded ? "Collapse all" : "Expand all"}
                </Button>
              )}
            </div>
            {canCreate && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowDrafts(true)} tooltip="View saved report drafts">
                  <FilePen className="h-4 w-4 mr-1" />
                  Drafts
                  {draftCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-orange-100 text-orange-700 px-1.5 text-xs font-semibold">
                      {draftCount}
                    </span>
                  )}
                </Button>
                <Link href="/reports/fellow-monthly/new" data-tooltip="Create a new fellow monthly report">
                  <Button size="sm" tooltip="Create a new fellow monthly report">
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
                <th className="px-4 py-3 font-medium text-gray-600">
                  {groupByMentor ? "Mentor / Month / Fellow" : "Month / Fellow"}
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">LGA</th>
                <th className="px-4 py-3 font-medium text-gray-600">Attendance</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Progress</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-gray-400">
                    Loading reports…
                  </td>
                </tr>
              ) : !reports.length ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex flex-col items-center space-y-2">
                      <FileText className="h-8 w-8 text-gray-300" />
                      <p>No fellow monthly reports found.</p>
                      {canCreate && (
                        <Link href="/reports/fellow-monthly/new" data-tooltip="Create your first fellow monthly report">
                          <span className="text-orange-600 hover:underline">
                            Create your first fellow monthly report
                          </span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : groupByMentor ? (
                groups.flatMap((g) => {
                  const open = expanded.has(g.key);
                  const fellowTotal = fellowCounts[g.mentorId];
                  const reportsMeta =
                    fellowTotal !== undefined
                      ? `${g.count} report${g.count === 1 ? "" : "s"} / ${fellowTotal} fellow${fellowTotal === 1 ? "" : "s"}`
                      : `${g.count} report${g.count === 1 ? "" : "s"}`;
                  return [
                    <GroupToggle
                      key={g.key}
                      expanded={open}
                      onClick={() => toggle(g.key)}
                      label={g.label}
                      meta={`${reportsMeta} · ${g.months.length} month${g.months.length === 1 ? "" : "s"}`}
                      colSpan={columnCount}
                      tone="mentor"
                    />,
                    ...(open ? g.months.flatMap((m) => renderMonthGroup(m, true, fellowTotal)) : []),
                  ];
                })
              ) : (
                groups.flatMap((g) => g.months.flatMap((m) => renderMonthGroup(m, false)))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500 flex-wrap gap-3">
            <span>
              Page {pagination.page} of {pagination.totalPages} (
              {groupByMentor
                ? `${pagination.total} mentor${pagination.total === 1 ? "" : "s"} · ${reportTotal} report${reportTotal === 1 ? "" : "s"}`
                : `${pagination.total} report${pagination.total === 1 ? "" : "s"}`}
              )
            </span>
            <div className="flex items-center gap-3">
              {groupByMentor ? (
                <select
                  value={mentorsPerPage}
                  onChange={(e) => { setMentorsPerPage(Number(e.target.value)); setPage(1); }}
                  aria-label="Mentors per page"
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>{size} mentors / page</option>
                  ))}
                </select>
              ) : (
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  aria-label="Reports per page"
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                >
                  {[10, 15, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  tooltip="Go to previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  tooltip="Go to next page"
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
