/* ──────────────────────────────────────────
   Fellow Sessions page (mentor + admin)
   Collates the session details recorded for a
   single fellow across the mentor's weekly
   reports, with filtering, pagination and export.
   Exports always cover every filtered session,
   regardless of the page being viewed.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileDown, Search } from "lucide-react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { api, type FellowSessionItem, type FellowSessionsResponse } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { isCapstoneSeason, sessionTopicLabel } from "@/lib/report-season";
import { downloadFile } from "@/lib/export";
import { exportElementToPdf } from "@/lib/pdf-export";

const TZ = "Africa/Lagos";
const PAGE_SIZE = 10;
/** Largest page the API serves; used to pull every filtered session for export. */
const EXPORT_PAGE_SIZE = 100;

const PERIOD_OPTIONS = [
    { label: "All time", value: "" },
    { label: "This week", value: "this_week" },
    { label: "This month", value: "this_month" },
    { label: "Last month", value: "last_month" },
    { label: "Last 3 months", value: "last_3_months" },
    { label: "This year", value: "this_year" },
    { label: "Custom range", value: "custom" },
];

const SEASON_OPTIONS = [
    { label: "All seasons", value: "" },
    { label: "Regular", value: "regular" },
    { label: "Capstone", value: "capstone" },
];

const REPORT_STATUS_OPTIONS = [
    { label: "Submitted & reviewed", value: "" },
    { label: "Submitted", value: "submitted" },
    { label: "Reviewed", value: "reviewed" },
];
const DRAFT_STATUS_OPTION = { label: "Drafts", value: "draft" };

type ExportFormat = "json" | "pdf" | "txt";

const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
    { format: "json", label: "JSON" },
    { format: "pdf", label: "PDF" },
    { format: "txt", label: "Text" },
];

interface Filters {
    period: string;
    from: string;
    to: string;
    season: string;
    reportStatus: string;
    search: string;
}

const EMPTY_FILTERS: Filters = { period: "", from: "", to: "", season: "", reportStatus: "", search: "" };

const optionLabel = (options: { label: string; value: string }[], value: string) =>
    options.find((o) => o.value === value)?.label ?? value;

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Resolve a period preset to a YYYY-MM-DD range, anchored on today in the app timezone. */
function periodRange(period: string): { from: string; to: string } {
    const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
    const mi = m - 1;
    switch (period) {
        case "this_week": {
            const sinceMonday = (new Date(Date.UTC(y, mi, d)).getUTCDay() + 6) % 7;
            return { from: toDay(Date.UTC(y, mi, d - sinceMonday)), to: toDay(Date.UTC(y, mi, d - sinceMonday + 6)) };
        }
        case "this_month":
            return { from: toDay(Date.UTC(y, mi, 1)), to: toDay(Date.UTC(y, mi + 1, 0)) };
        case "last_month":
            return { from: toDay(Date.UTC(y, mi - 1, 1)), to: toDay(Date.UTC(y, mi, 0)) };
        case "last_3_months":
            return { from: toDay(Date.UTC(y, mi - 2, 1)), to: toDay(Date.UTC(y, mi + 1, 0)) };
        case "this_year":
            return { from: toDay(Date.UTC(y, 0, 1)), to: toDay(Date.UTC(y, 11, 31)) };
        default:
            return { from: "", to: "" };
    }
}

/** Query params for the active filters (no paging). */
function filterParams(f: Filters): Record<string, string> {
    const params: Record<string, string> = {};
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    if (f.season) params.season = f.season;
    if (f.reportStatus) params.reportStatus = f.reportStatus;
    if (f.search) params.q = f.search;
    return params;
}

/** Session dates are stored as UTC midnight of the chosen day, so format them in UTC. */
function fmtDay(value: string) {
    return new Date(value).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

const statusLabel = (status: string) => (status === "draft" ? "Draft" : status === "reviewed" ? "Reviewed" : "Submitted");

const fileSlug = (name: string) =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fellow";

function BulletList({ title, items }: { title: string; items: string[] }) {
    const clean = items.filter((i) => i.trim());
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</p>
            {clean.length ? (
                <ul className="list-disc pl-5 space-y-0.5 text-sm text-gray-700">
                    {clean.map((item, i) => (
                        <li key={i} className="break-words">{item}</li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-gray-400">—</p>
            )}
        </div>
    );
}

function SessionCard({ session: s }: { session: FellowSessionItem }) {
    return (
        <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        {fmtDay(s.sessionDate)}
                        <span className="font-normal text-gray-600">
                            {" "}· {s.startTime} – {s.endTime} ({s.duration})
                        </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Week {s.weekKey}
                        {s.menteeLGA ? ` · ${s.menteeLGA}` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isCapstoneSeason(s.season) && <Badge variant="info">Capstone</Badge>}
                    {s.reportStatus === "draft" && <Badge variant="warning">Draft</Badge>}
                    {s.reportStatus === "reviewed" && <Badge variant="secondary">Reviewed</Badge>}
                    <Link
                        href={`/reports/${s.reportId}`}
                        className="inline-flex items-center text-xs text-orange-700 hover:underline"
                        data-export-ignore
                    >
                        View report <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                </div>
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    {sessionTopicLabel(s.season)}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{s.topicDiscussed}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BulletList title="Challenges" items={s.challenges} />
                <BulletList title="Solutions" items={s.solutions} />
                <BulletList title="Action Plan" items={s.actionPlan} />
            </div>
        </div>
    );
}

function ListHeading({ name, lga, filterSummary }: { name: string; lga?: string; filterSummary: string }) {
    return (
        <div className="bg-white rounded-lg border px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900">
                Sessions with {name}
                {lga && <span className="font-normal text-gray-500"> · {lga}</span>}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{filterSummary}</p>
        </div>
    );
}

export default function FellowSessionsPage() {
    const { id } = useParams() as { id: string };
    const { data: session } = useSession();
    const role = session?.user?.role;
    const isMentor = role === UserRole.MENTOR;

    const [data, setData] = useState<FellowSessionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [exporting, setExporting] = useState<ExportFormat | null>(null);
    /** Every filtered session, rendered off-screen only while a PDF is being generated. */
    const [pdfSessions, setPdfSessions] = useState<FellowSessionItem[] | null>(null);
    const pdfRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError("");
            try {
                const res = await api.fellows.sessions(id, {
                    ...filterParams(filters),
                    page: String(page),
                    limit: String(PAGE_SIZE),
                });
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load sessions.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [id, filters, page]);

    if (session?.user && role !== UserRole.MENTOR && role !== UserRole.ADMIN) {
        return (
            <div className="p-12 text-center text-gray-500">
                You do not have permission to view this page.
            </div>
        );
    }

    const fellowName = data?.fellow.name ?? "Fellow";
    const fellowLga = data?.fellow.lga;
    const sessions = data?.sessions ?? [];
    const total = data?.total ?? 0;
    const totalPages = data?.pagination.totalPages ?? 1;
    const statusOptions = isMentor ? [...REPORT_STATUS_OPTIONS, DRAFT_STATUS_OPTION] : REPORT_STATUS_OPTIONS;
    const { from, to } = filters;
    const hasFilters = Boolean(from || to || filters.season || filters.reportStatus || filters.search);

    const filterSummary = [
        `Period: ${from || to ? `${from ? fmtDay(from) : "…"} – ${to ? fmtDay(to) : "…"}` : "All time"}`,
        `Season: ${optionLabel(SEASON_OPTIONS, filters.season)}`,
        `Reports: ${optionLabel(statusOptions, filters.reportStatus)}`,
        ...(filters.search ? [`Keyword: "${filters.search}"`] : []),
    ].join(" · ");

    /** Any filter change starts again from the first page. */
    const updateFilters = (patch: Partial<Filters>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
        setPage(1);
    };

    const handlePeriodChange = (period: string) =>
        updateFilters(period === "custom" ? { period } : { period, ...periodRange(period) });

    const clearFilters = () => {
        setSearchInput("");
        updateFilters(EMPTY_FILTERS);
    };

    /** Fetch every session matching the filters, independent of the page on screen. */
    async function fetchAllSessions(): Promise<FellowSessionItem[]> {
        const all: FellowSessionItem[] = [];
        for (let p = 1; ; p++) {
            const res = await api.fellows.sessions(id, {
                ...filterParams(filters),
                page: String(p),
                limit: String(EXPORT_PAGE_SIZE),
            });
            all.push(...res.sessions);
            if (p >= res.pagination.totalPages) break;
        }
        return all;
    }

    async function handleExport(format: ExportFormat) {
        if (!total) return;
        const filename = `sessions-${fileSlug(fellowName)}-${new Date().toISOString().slice(0, 10)}`;
        setExporting(format);
        try {
            const all = await fetchAllSessions();
            if (format === "json") {
                const payload = {
                    fellow: data?.fellow,
                    filters: {
                        from: from || null,
                        to: to || null,
                        season: filters.season || null,
                        reportStatus: filters.reportStatus || "submitted+reviewed",
                        keyword: filters.search || null,
                    },
                    generatedAt: new Date().toISOString(),
                    total: all.length,
                    sessions: all.map((s) => ({
                        sessionDate: s.sessionDate.slice(0, 10),
                        startTime: s.startTime,
                        endTime: s.endTime,
                        duration: s.duration,
                        menteeLGA: s.menteeLGA ?? null,
                        weekKey: s.weekKey,
                        season: s.season ?? "regular",
                        reportStatus: s.reportStatus,
                        reportId: s.reportId,
                        topicDiscussed: s.topicDiscussed,
                        challenges: s.challenges,
                        solutions: s.solutions,
                        actionPlan: s.actionPlan,
                    })),
                };
                downloadFile(JSON.stringify(payload, null, 2), `${filename}.json`, "application/json");
            } else if (format === "txt") {
                const bullets = (title: string, items: string[]) => {
                    const clean = items.filter((i) => i.trim());
                    return clean.length ? [`   ${title}:`, ...clean.map((i) => `     - ${i}`)] : [`   ${title}: —`];
                };
                const lines = [
                    `Sessions with ${fellowName}${fellowLga ? ` (${fellowLga})` : ""}`,
                    `Filters: ${filterSummary}`,
                    `Generated: ${new Date().toLocaleString("en-GB", { timeZone: TZ })}`,
                    `Total: ${all.length} session${all.length === 1 ? "" : "s"}`,
                    "",
                    ...all.flatMap((s, i) => [
                        `${i + 1}. ${fmtDay(s.sessionDate)}, ${s.startTime} – ${s.endTime} (${s.duration})`,
                        `   Week: ${s.weekKey} · ${isCapstoneSeason(s.season) ? "Capstone" : "Regular"} · ${statusLabel(s.reportStatus)}`,
                        `   ${sessionTopicLabel(s.season)}: ${s.topicDiscussed}`,
                        ...bullets("Challenges", s.challenges),
                        ...bullets("Solutions", s.solutions),
                        ...bullets("Action Plan", s.actionPlan),
                        "",
                    ]),
                ];
                downloadFile(lines.join("\n"), `${filename}.txt`, "text/plain;charset=utf-8");
            } else if (format === "pdf") {
                // Render the full list off-screen synchronously, then capture it.
                flushSync(() => setPdfSessions(all));
                if (pdfRef.current) await exportElementToPdf(pdfRef.current, { filename });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Export failed.");
        } finally {
            setPdfSessions(null);
            setExporting(null);
        }
    }

    return (
        <>
            <Header
                title={`Sessions with ${fellowName}`}
                subtitle="Session details recorded for this fellow in weekly reports"
            />
            <div className="p-4 md:p-6 space-y-4">
                <Link href="/fellows" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to fellows
                </Link>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-lg border p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        <Select
                            id="session-period"
                            label="Period"
                            options={PERIOD_OPTIONS}
                            value={filters.period}
                            onChange={(e) => handlePeriodChange(e.target.value)}
                        />
                        <Input
                            id="session-from"
                            label="From"
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => updateFilters({ period: "custom", from: e.target.value })}
                        />
                        <Input
                            id="session-to"
                            label="To"
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => updateFilters({ period: "custom", to: e.target.value })}
                        />
                        <Select
                            id="session-season"
                            label="Season"
                            options={SEASON_OPTIONS}
                            value={filters.season}
                            onChange={(e) => updateFilters({ season: e.target.value })}
                        />
                        <Select
                            id="session-report-status"
                            label="Reports"
                            options={statusOptions}
                            value={filters.reportStatus}
                            onChange={(e) => updateFilters({ reportStatus: e.target.value })}
                        />
                    </div>
                    <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            updateFilters({ search: searchInput.trim() });
                        }}
                    >
                        <div className="relative flex-1 min-w-56 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search topic, challenges, solutions, action plan…"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full pl-9 pr-4 h-10 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
                            />
                        </div>
                        <Button type="submit" size="sm" variant="outline" tooltip="Filter sessions by keyword">
                            Search
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={clearFilters}
                            disabled={!hasFilters && !searchInput}
                            tooltip="Reset all session filters"
                        >
                            Clear filters
                        </Button>
                    </form>
                </div>

                {/* Summary + export */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-600">
                        {loading
                            ? "Loading…"
                            : `${total} session${total === 1 ? "" : "s"} across ${data?.reportCount ?? 0} weekly report${data?.reportCount === 1 ? "" : "s"}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-500">Export all {total}:</span>
                        {EXPORT_FORMATS.map(({ format, label }) => (
                            <Button
                                key={format}
                                variant="outline"
                                size="sm"
                                onClick={() => handleExport(format)}
                                disabled={loading || !total || exporting !== null}
                                tooltip={`Download every filtered session (all pages) as ${label}`}
                            >
                                <FileDown className="h-4 w-4 mr-1" />
                                {exporting === format ? "Exporting…" : label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Current page of sessions */}
                <div className="space-y-3">
                    <ListHeading name={fellowName} lga={fellowLga} filterSummary={filterSummary} />
                    {loading ? (
                        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
                    ) : !sessions.length ? (
                        <div className="bg-white rounded-lg border px-4 py-8 text-center text-sm text-gray-400">
                            {hasFilters
                                ? "No sessions match these filters."
                                : "No sessions have been recorded for this fellow in weekly reports yet."}
                        </div>
                    ) : (
                        sessions.map((s) => <SessionCard key={s._id} session={s} />)
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>
                            Page {page} of {totalPages} &mdash; {total} session{total === 1 ? "" : "s"}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => p - 1)}
                                tooltip="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage((p) => p + 1)}
                                tooltip="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Off-screen PDF source: every filtered session, not just the current page */}
            {pdfSessions && (
                <div aria-hidden="true" className="fixed top-0 -left-[10000px] w-[1200px] pointer-events-none">
                    <div ref={pdfRef} className="space-y-3 bg-white p-1">
                        <ListHeading name={fellowName} lga={fellowLga} filterSummary={filterSummary} />
                        {pdfSessions.map((s) => (
                            <SessionCard key={s._id} session={s} />
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
