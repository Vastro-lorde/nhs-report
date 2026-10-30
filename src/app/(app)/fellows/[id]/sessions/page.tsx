/* ──────────────────────────────────────────
   Fellow Sessions page (mentor + admin)
   View, filter and export the mentorship
   sessions held with a single fellow.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { api, type BookingItem, type Fellow } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { toExternalUrl } from "@/lib/utils";
import { downloadFile, exportToCSV } from "@/lib/export";
import { exportElementToPdf } from "@/lib/pdf-export";

const TZ = "Africa/Lagos";

const STATUS_OPTIONS = [
    { label: "All statuses", value: "" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Completed", value: "completed" },
    { label: "No-show", value: "no_show" },
    { label: "Cancelled", value: "cancelled" },
];

const TIMEFRAME_OPTIONS = [
    { label: "All time", value: "" },
    { label: "Upcoming", value: "upcoming" },
    { label: "Past", value: "past" },
];

type ExportFormat = "json" | "csv" | "pdf" | "txt";

const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
    { format: "json", label: "JSON" },
    { format: "csv", label: "CSV" },
    { format: "pdf", label: "PDF" },
    { format: "txt", label: "Text" },
];

const optionLabel = (options: { label: string; value: string }[], value: string) =>
    options.find((o) => o.value === value)?.label ?? value;

const statusVariant = (status: string) =>
    status === "confirmed"
        ? "info"
        : status === "cancelled"
          ? "destructive"
          : status === "no_show"
            ? "warning"
            : "secondary";

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
        timeZone: TZ,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

const durationMinutes = (b: BookingItem) =>
    Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000);

const fileSlug = (name: string) =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fellow";

export default function FellowSessionsPage() {
    const { id } = useParams() as { id: string };
    const { data: session } = useSession();
    const role = session?.user?.role;

    const [fellow, setFellow] = useState<Fellow | null>(null);
    const [sessions, setSessions] = useState<BookingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [timeframe, setTimeframe] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [exporting, setExporting] = useState<ExportFormat | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.fellows
            .get(id)
            .then(setFellow)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load fellow."));
    }, [id]);

    // Load every session matching the filters (not just one page) so the
    // on-screen list and every export cover exactly the same set.
    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError("");
            const params: Record<string, string> = { fellowId: id, order: "desc", limit: "100" };
            if (status) params.status = status;
            if (timeframe === "upcoming") params.upcoming = "true";
            if (timeframe === "past") params.past = "true";
            if (from) params.from = from;
            if (to) params.to = to;
            try {
                const all: BookingItem[] = [];
                for (let page = 1; ; page++) {
                    const res = await api.bookings.list({ ...params, page: String(page) });
                    all.push(...res.data);
                    if (page >= res.pagination.totalPages) break;
                }
                if (!cancelled) setSessions(all);
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
    }, [id, status, timeframe, from, to]);

    if (session?.user && role !== UserRole.MENTOR && role !== UserRole.ADMIN) {
        return (
            <div className="p-12 text-center text-gray-500">
                You do not have permission to view this page.
            </div>
        );
    }

    const fellowName = fellow?.name ?? "Fellow";
    const hasFilters = Boolean(status || timeframe || from || to);

    const filterSummary = [
        `Status: ${optionLabel(STATUS_OPTIONS, status)}`,
        `Timeframe: ${optionLabel(TIMEFRAME_OPTIONS, timeframe)}`,
        `From: ${from ? fmtDate(`${from}T12:00:00+01:00`) : "—"}`,
        `To: ${to ? fmtDate(`${to}T12:00:00+01:00`) : "—"}`,
    ].join(" · ");

    const clearFilters = () => {
        setStatus("");
        setTimeframe("");
        setFrom("");
        setTo("");
    };

    async function handleExport(format: ExportFormat) {
        if (!sessions.length) return;
        const filename = `sessions-${fileSlug(fellowName)}-${new Date().toISOString().slice(0, 10)}`;
        setExporting(format);
        try {
            if (format === "json") {
                const payload = {
                    fellow: { id, name: fellowName, lga: fellow?.lga },
                    filters: {
                        status: status || null,
                        timeframe: timeframe || null,
                        from: from || null,
                        to: to || null,
                    },
                    generatedAt: new Date().toISOString(),
                    total: sessions.length,
                    sessions: sessions.map((b) => ({
                        id: b._id,
                        startAt: b.startAt,
                        endAt: b.endAt,
                        durationMinutes: durationMinutes(b),
                        status: b.status,
                        note: b.note ?? null,
                        meetingLink: b.meetingLink ?? null,
                        bookedAt: b.createdAt,
                    })),
                };
                downloadFile(JSON.stringify(payload, null, 2), `${filename}.json`, "application/json");
            } else if (format === "csv") {
                exportToCSV(
                    sessions.map((b) => ({
                        Date: fmtDate(b.startAt),
                        Start: fmtTime(b.startAt),
                        End: fmtTime(b.endAt),
                        "Duration (mins)": durationMinutes(b),
                        Status: optionLabel(STATUS_OPTIONS, b.status),
                        Note: b.note ?? "",
                        "Meeting Link": b.meetingLink ?? "",
                        "Booked On": fmtDate(b.createdAt),
                    })),
                    filename,
                );
            } else if (format === "txt") {
                const lines = [
                    `Sessions with ${fellowName}`,
                    `Filters: ${filterSummary}`,
                    `Generated: ${new Date().toLocaleString("en-GB", { timeZone: TZ })}`,
                    `Total: ${sessions.length}`,
                    "",
                    ...sessions.flatMap((b, i) => [
                        `${i + 1}. ${fmtDate(b.startAt)}, ${fmtTime(b.startAt)} – ${fmtTime(b.endAt)} (${durationMinutes(b)} mins)`,
                        `   Status: ${optionLabel(STATUS_OPTIONS, b.status)}`,
                        ...(b.note ? [`   Note: ${b.note}`] : []),
                        ...(b.meetingLink ? [`   Meeting link: ${b.meetingLink}`] : []),
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
            <Header title={`Sessions with ${fellowName}`} subtitle="Mentorship sessions booked with this fellow" />
            <div className="p-4 md:p-6 space-y-4">
                <Link href="/fellows" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to fellows
                </Link>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-lg border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <Select
                        id="session-status"
                        label="Status"
                        options={STATUS_OPTIONS}
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    />
                    <Select
                        id="session-timeframe"
                        label="Timeframe"
                        options={TIMEFRAME_OPTIONS}
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                    />
                    <Input
                        id="session-from"
                        label="From"
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                    <Input
                        id="session-to"
                        label="To"
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => setTo(e.target.value)}
                    />
                    <Button
                        variant="ghost"
                        onClick={clearFilters}
                        disabled={!hasFilters}
                        tooltip="Reset all session filters"
                    >
                        Clear filters
                    </Button>
                </div>

                {/* Export */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-600">
                        {loading ? "Loading…" : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
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

                {/* Sessions table — also the PDF export target */}
                <div ref={exportRef} className="bg-white rounded-lg border overflow-x-auto">
                    <div className="px-4 py-3 border-b">
                        <h2 className="text-base font-semibold text-gray-900">Sessions with {fellowName}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{filterSummary}</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Time</th>
                                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Duration</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Note</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right" data-export-ignore>
                                    <span className="sr-only">Join</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                                </tr>
                            ) : !sessions.length ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                        {hasFilters ? "No sessions match these filters." : "No sessions with this fellow yet."}
                                    </td>
                                </tr>
                            ) : (
                                sessions.map((b) => {
                                    const canJoin =
                                        b.status === "confirmed" &&
                                        b.meetingLink &&
                                        new Date(b.endAt).getTime() > Date.now();
                                    return (
                                        <tr key={b._id} className="hover:bg-gray-50 align-top">
                                            <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtDate(b.startAt)}</td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                {fmtTime(b.startAt)} – {fmtTime(b.endAt)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 hidden sm:table-cell whitespace-nowrap">
                                                {durationMinutes(b)} mins
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={statusVariant(b.status)}>
                                                    {optionLabel(STATUS_OPTIONS, b.status)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 max-w-md whitespace-pre-wrap break-words">
                                                {b.note || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right" data-export-ignore>
                                                {canJoin && (
                                                    <a
                                                        href={toExternalUrl(b.meetingLink!)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-orange-700 hover:underline"
                                                        data-tooltip="Join Google Meet session in new tab"
                                                    >
                                                        Join
                                                    </a>
                                                )}
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
