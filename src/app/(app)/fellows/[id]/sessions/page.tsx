/* ──────────────────────────────────────────
   Fellow Sessions page (mentor + admin)
   Collates the session details recorded for a
   single fellow across the mentor's weekly
   reports, with filtering and export.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileDown, Search } from "lucide-react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { api, type FellowSessionItem, type FellowSessionsResponse } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { isCapstoneSeason, sessionTopicLabel } from "@/lib/report-season";
import { downloadFile, exportToCSV } from "@/lib/export";
import { exportElementToPdf } from "@/lib/pdf-export";

const TZ = "Africa/Lagos";

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

type ExportFormat = "json" | "csv" | "pdf" | "txt";

const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
    { format: "json", label: "JSON" },
    { format: "csv", label: "CSV" },
    { format: "pdf", label: "PDF" },
    { format: "txt", label: "Text" },
];

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

export default function FellowSessionsPage() {
    const { id } = useParams() as { id: string };
    const { data: session } = useSession();
    const role = session?.user?.role;
    const isMentor = role === UserRole.MENTOR;

    const [data, setData] = useState<FellowSessionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [season, setSeason] = useState("");
    const [reportStatus, setReportStatus] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [exporting, setExporting] = useState<ExportFormat | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError("");
            const params: Record<string, string> = {};
            if (from) params.from = from;
            if (to) params.to = to;
            if (season) params.season = season;
            if (reportStatus) params.reportStatus = reportStatus;
            if (search) params.q = search;
            try {
                const res = await api.fellows.sessions(id, params);
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
    }, [id, from, to, season, reportStatus, search]);

    if (session?.user && role !== UserRole.MENTOR && role !== UserRole.ADMIN) {
        return (
            <div className="p-12 text-center text-gray-500">
                You do not have permission to view this page.
            </div>
        );
    }

    const fellowName = data?.fellow.name ?? "Fellow";
    const sessions = data?.sessions ?? [];
    const statusOptions = isMentor ? [...REPORT_STATUS_OPTIONS, DRAFT_STATUS_OPTION] : REPORT_STATUS_OPTIONS;
    const hasFilters = Boolean(from || to || season || reportStatus || search);

    const filterSummary = [
        `Period: ${from || to ? `${from ? fmtDay(from) : "…"} – ${to ? fmtDay(to) : "…"}` : "All time"}`,
        `Season: ${optionLabel(SEASON_OPTIONS, season)}`,
        `Reports: ${optionLabel(statusOptions, reportStatus)}`,
        ...(search ? [`Keyword: "${search}"`] : []),
    ].join(" · ");

    const handlePeriodChange = (value: string) => {
        setPeriod(value);
        if (value !== "custom") {
            const range = periodRange(value);
            setFrom(range.from);
            setTo(range.to);
        }
    };

    const clearFilters = () => {
        setPeriod("");
        setFrom("");
        setTo("");
        setSeason("");
        setReportStatus("");
        setSearchInput("");
        setSearch("");
    };

    const topicLabel = (s: FellowSessionItem) => sessionTopicLabel(s.season);

    async function handleExport(format: ExportFormat) {
        if (!sessions.length) return;
        const filename = `sessions-${fileSlug(fellowName)}-${new Date().toISOString().slice(0, 10)}`;
        setExporting(format);
        try {
            if (format === "json") {
                const payload = {
                    fellow: data?.fellow,
                    filters: {
                        from: from || null,
                        to: to || null,
                        season: season || null,
                        reportStatus: reportStatus || "submitted+reviewed",
                        keyword: search || null,
                    },
                    generatedAt: new Date().toISOString(),
                    total: sessions.length,
                    sessions: sessions.map((s) => ({
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
            } else if (format === "csv") {
                exportToCSV(
                    sessions.map((s) => ({
                        Date: s.sessionDate.slice(0, 10),
                        "Start Time": s.startTime,
                        "End Time": s.endTime,
                        Duration: s.duration,
                        LGA: s.menteeLGA ?? "",
                        Week: s.weekKey,
                        Season: isCapstoneSeason(s.season) ? "Capstone" : "Regular",
                        "Report Status": statusLabel(s.reportStatus),
                        "Topic Discussed": s.topicDiscussed,
                        Challenges: s.challenges,
                        Solutions: s.solutions,
                        "Action Plan": s.actionPlan,
                    })),
                    filename,
                );
            } else if (format === "txt") {
                const bullets = (title: string, items: string[]) => {
                    const clean = items.filter((i) => i.trim());
                    return clean.length ? [`   ${title}:`, ...clean.map((i) => `     - ${i}`)] : [`   ${title}: —`];
                };
                const lines = [
                    `Sessions with ${fellowName}${data?.fellow.lga ? ` (${data.fellow.lga})` : ""}`,
                    `Filters: ${filterSummary}`,
                    `Generated: ${new Date().toLocaleString("en-GB", { timeZone: TZ })}`,
                    `Total: ${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
                    "",
                    ...sessions.flatMap((s, i) => [
                        `${i + 1}. ${fmtDay(s.sessionDate)}, ${s.startTime} – ${s.endTime} (${s.duration})`,
                        `   Week: ${s.weekKey} · ${isCapstoneSeason(s.season) ? "Capstone" : "Regular"} · ${statusLabel(s.reportStatus)}`,
                        `   ${topicLabel(s)}: ${s.topicDiscussed}`,
                        ...bullets("Challenges", s.challenges),
                        ...bullets("Solutions", s.solutions),
                        ...bullets("Action Plan", s.actionPlan),
                        "",
                    ]),
                ];
                downloadFile(lines.join("\n"), `${filename}.txt`, "text/plain;charset=utf-8");
            } else if (format === "pdf" && exportRef.current) {
                await exportElementToPdf(exportRef.current, { filename });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Export failed.");
        } finally {
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
                            value={period}
                            onChange={(e) => handlePeriodChange(e.target.value)}
                        />
                        <Input
                            id="session-from"
                            label="From"
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => {
                                setPeriod("custom");
                                setFrom(e.target.value);
                            }}
                        />
                        <Input
                            id="session-to"
                            label="To"
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => {
                                setPeriod("custom");
                                setTo(e.target.value);
                            }}
                        />
                        <Select
                            id="session-season"
                            label="Season"
                            options={SEASON_OPTIONS}
                            value={season}
                            onChange={(e) => setSeason(e.target.value)}
                        />
                        <Select
                            id="session-report-status"
                            label="Reports"
                            options={statusOptions}
                            value={reportStatus}
                            onChange={(e) => setReportStatus(e.target.value)}
                        />
                    </div>
                    <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setSearch(searchInput.trim());
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
                            : `${sessions.length} session${sessions.length === 1 ? "" : "s"} across ${data?.reportCount ?? 0} weekly report${data?.reportCount === 1 ? "" : "s"}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-500">Export:</span>
                        {EXPORT_FORMATS.map(({ format, label }) => (
                            <Button
                                key={format}
                                variant="outline"
                                size="sm"
                                onClick={() => handleExport(format)}
                                disabled={loading || !sessions.length || exporting !== null}
                                tooltip={`Download the filtered sessions as ${label}`}
                            >
                                <FileDown className="h-4 w-4 mr-1" />
                                {exporting === format ? "Exporting…" : label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Session list — also the PDF export target */}
                <div ref={exportRef} className="space-y-3">
                    <div className="bg-white rounded-lg border px-4 py-3">
                        <h2 className="text-base font-semibold text-gray-900">
                            Sessions with {fellowName}
                            {data?.fellow.lga && <span className="font-normal text-gray-500"> · {data.fellow.lga}</span>}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">{filterSummary}</p>
                    </div>

                    {loading ? (
                        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
                    ) : !sessions.length ? (
                        <div className="bg-white rounded-lg border px-4 py-8 text-center text-sm text-gray-400">
                            {hasFilters
                                ? "No sessions match these filters."
                                : "No sessions have been recorded for this fellow in weekly reports yet."}
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <div key={s._id} className="bg-white rounded-lg border p-4 space-y-3">
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
                                        {topicLabel(s)}
                                    </p>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{s.topicDiscussed}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <BulletList title="Challenges" items={s.challenges} />
                                    <BulletList title="Solutions" items={s.solutions} />
                                    <BulletList title="Action Plan" items={s.actionPlan} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
