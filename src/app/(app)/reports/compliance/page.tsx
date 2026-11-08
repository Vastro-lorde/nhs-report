/* ──────────────────────────────────────────
   Report Compliance page (staff above mentor)
   Mentors who haven't submitted weekly reports
   and fellows with no session recorded, for a
   chosen range of weeks. Scope is enforced by
   the API: admins / M&E / TRLs see everyone,
   coordinators and desk officers their zone.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileDown, Search } from "lucide-react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
    api,
    type ComplianceFellowItem,
    type ComplianceMentorItem,
    type ReportComplianceResponse,
} from "@/lib/api-client";
import { UserRole, displayState } from "@/lib/constants";
import { isoWeekKey, subWeeks, weekRangeLabelFromWeekKey } from "@/lib/date-helpers";
import { exportToCSV } from "@/lib/export";
import { cn } from "@/lib/utils";

const ALLOWED_ROLES: string[] = [
    UserRole.ADMIN,
    UserRole.COORDINATOR,
    UserRole.ZONAL_DESK_OFFICER,
    UserRole.ME_OFFICER,
    UserRole.TEAM_RESEARCH_LEAD,
];

const PAGE_SIZE = 25;

const WEEK_KEY = /^\d{4}-W\d{2}$/;

const PERIOD_OPTIONS = [
    { label: "This week", value: "0:0" },
    { label: "Last week", value: "1:1" },
    { label: "Last 4 weeks", value: "3:0" },
    { label: "Last 8 weeks", value: "7:0" },
    { label: "Last 12 weeks", value: "11:0" },
    { label: "Custom range", value: "custom" },
];

const REASON_OPTIONS = [
    { label: "All reasons", value: "" },
    { label: "Mentor submitted no report", value: "mentor_no_report" },
    { label: "Left out of mentor's reports", value: "not_in_report" },
];

type Tab = "mentors" | "fellows";

/** "a:b" → weeks from a weeks ago through b weeks ago. */
function presetRange(value: string): { fromWeek: string; toWeek: string } {
    const [back, until] = value.split(":").map(Number);
    const now = new Date();
    return { fromWeek: isoWeekKey(subWeeks(now, back)), toWeek: isoWeekKey(subWeeks(now, until)) };
}

const fmtDate = (value: string | null) =>
    value
        ? new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })
        : "—";

const rangeLabel = (weeks: string[]) =>
    weeks.length === 0
        ? ""
        : weeks.length === 1
          ? weekRangeLabelFromWeekKey(weeks[0])
          : `${weekRangeLabelFromWeekKey(weeks[0])} → ${weekRangeLabelFromWeekKey(weeks[weeks.length - 1])}`;

function SummaryCard({ label, value, of, tone }: { label: string; value: number; of: number; tone: "red" | "amber" }) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className={cn("text-2xl font-bold mt-1", tone === "red" ? "text-red-700" : "text-amber-700")}>
                {value}
                <span className="text-sm font-normal text-gray-500"> of {of}</span>
            </p>
        </div>
    );
}

function Pagination({
    page,
    totalPages,
    total,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
}) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
                Page {page} of {totalPages} &mdash; {total} row{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} tooltip="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    tooltip="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function MentorTable({ rows, multiWeek }: { rows: ComplianceMentorItem[]; multiWeek: boolean }) {
    return (
        <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                    <th className="px-4 py-3">Mentor</th>
                    <th className="px-4 py-3">State(s)</th>
                    <th className="px-4 py-3">Coordinator</th>
                    <th className="px-4 py-3">{multiWeek ? "Weeks missed" : "Status"}</th>
                    <th className="px-4 py-3">Last submitted</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {rows.map((m) => (
                    <tr key={m.mentorId} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3">
                            <Link href={`/mentors/${m.userId}`} className="font-medium text-gray-900 hover:text-orange-700 hover:underline">
                                {m.name}
                            </Link>
                            <p className="text-xs text-gray-500">{m.email}</p>
                            {m.phone && <p className="text-xs text-gray-500">{m.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{m.states.map(displayState).join(", ") || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{m.coordinatorName || "—"}</td>
                        <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1">
                                {multiWeek && (
                                    <span className="font-semibold text-red-700 mr-1">
                                        {m.missingWeeks.length} of {m.expectedWeeks}
                                    </span>
                                )}
                                {!multiWeek && <Badge variant="destructive">Not submitted</Badge>}
                                {m.draftWeeks.length > 0 && (
                                    <Badge
                                        variant="warning"
                                        title={`Draft started but not submitted: ${m.draftWeeks.join(", ")}`}
                                    >
                                        {multiWeek ? `${m.draftWeeks.length} draft${m.draftWeeks.length === 1 ? "" : "s"}` : "Draft started"}
                                    </Badge>
                                )}
                            </div>
                            {multiWeek && (
                                <p className="text-xs text-gray-500 mt-1 break-words">{m.missingWeeks.join(", ")}</p>
                            )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                            {m.lastSubmittedWeek ? (
                                <>
                                    {weekRangeLabelFromWeekKey(m.lastSubmittedWeek)}
                                    <p className="text-xs text-gray-500">{m.lastSubmittedWeek}</p>
                                </>
                            ) : (
                                <span className="text-gray-400">Never</span>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function FellowTable({ rows }: { rows: ComplianceFellowItem[] }) {
    return (
        <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                    <th className="px-4 py-3">Fellow</th>
                    <th className="px-4 py-3">LGA / State</th>
                    <th className="px-4 py-3">Mentor</th>
                    <th className="px-4 py-3">Why</th>
                    <th className="px-4 py-3">Last session recorded</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {rows.map((f) => (
                    <tr key={f.fellowId} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                        <td className="px-4 py-3 text-gray-700">
                            {f.lga || "—"}
                            <p className="text-xs text-gray-500">{f.state ? displayState(f.state) : "State unknown"}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{f.mentorName}</td>
                        <td className="px-4 py-3">
                            {f.reason === "mentor_no_report" ? (
                                <Badge variant="destructive">Mentor submitted no report</Badge>
                            ) : (
                                <>
                                    <Badge variant="warning">Left out of report</Badge>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Mentor reported {f.mentorReportedWeeks} of {f.expectedWeeks} week
                                        {f.expectedWeeks === 1 ? "" : "s"}
                                    </p>
                                </>
                            )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                            {f.lastSessionDate ? fmtDate(f.lastSessionDate) : <span className="text-gray-400">Never</span>}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function ReportCompliancePage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const role = session?.user?.role;
    const allowed = !!role && ALLOWED_ROLES.includes(role);

    const initial = useMemo(() => presetRange("0:0"), []);
    const [period, setPeriod] = useState("0:0");
    const [fromWeek, setFromWeek] = useState(initial.fromWeek);
    const [toWeek, setToWeek] = useState(initial.toWeek);
    const [state, setState] = useState("");
    /** Latest response, tagged with the query it answers so stale results read as loading. */
    const [result, setResult] = useState<{ key: string; data?: ReportComplianceResponse; error?: string } | null>(null);

    const [tab, setTab] = useState<Tab>("mentors");
    const [search, setSearch] = useState("");
    const [reason, setReason] = useState("");

    // Wait for a complete, ordered custom range before asking the server.
    const rangeValid = WEEK_KEY.test(fromWeek) && WEEK_KEY.test(toWeek) && fromWeek <= toWeek;
    const queryKey = `${fromWeek}|${toWeek}|${state}`;
    const loading = rangeValid && result?.key !== queryKey;
    const data = result?.data ?? null;
    const error = result?.key === queryKey ? result.error : undefined;

    // Any change to what's listed starts again from the first page.
    const listKey = `${queryKey}|${tab}|${search}|${reason}`;
    const [paging, setPaging] = useState({ key: listKey, page: 1 });
    const page = paging.key === listKey ? paging.page : 1;
    const setPage = (p: number) => setPaging({ key: listKey, page: p });

    // Mentors and fellows have no business here.
    useEffect(() => {
        if (status === "authenticated" && !allowed) router.replace("/unauthorized");
    }, [status, allowed, router]);

    useEffect(() => {
        if (!allowed || !rangeValid) return;
        let cancelled = false;
        api.reports
            .compliance({ fromWeek, toWeek, ...(state && { state }) })
            .then((res) => !cancelled && setResult({ key: queryKey, data: res }))
            .catch(
                (e) =>
                    !cancelled &&
                    setResult((prev) => ({
                        key: queryKey,
                        data: prev?.data,
                        error: e instanceof Error ? e.message : "Failed to load compliance data.",
                    })),
            );
        return () => {
            cancelled = true;
        };
    }, [allowed, rangeValid, queryKey, fromWeek, toWeek, state]);

    const term = search.trim().toLowerCase();
    const mentorRows = useMemo(
        () =>
            (data?.mentors ?? []).filter(
                (m) =>
                    !term ||
                    [m.name, m.email, m.phone, m.coordinatorName, ...m.states].some((v) => v?.toLowerCase().includes(term)),
            ),
        [data, term],
    );
    const fellowRows = useMemo(
        () =>
            (data?.fellows ?? []).filter(
                (f) =>
                    (!reason || f.reason === reason) &&
                    (!term || [f.name, f.lga, f.state ?? "", f.mentorName].some((v) => v.toLowerCase().includes(term))),
            ),
        [data, term, reason],
    );

    if (status === "loading" || !allowed) {
        return <div className="p-12 text-center text-gray-400">Loading…</div>;
    }

    const weeks = data?.weeks ?? [];
    const multiWeek = weeks.length > 1;
    const rows = tab === "mentors" ? mentorRows : fellowRows;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const rangeInvalid = WEEK_KEY.test(fromWeek) && WEEK_KEY.test(toWeek) && fromWeek > toWeek;

    const handlePeriod = (value: string) => {
        setPeriod(value);
        if (value === "custom") return;
        const r = presetRange(value);
        setFromWeek(r.fromWeek);
        setToWeek(r.toWeek);
    };

    const handleExport = () => {
        const stamp = weeks.length ? `${weeks[0]}_${weeks[weeks.length - 1]}` : new Date().toISOString().slice(0, 10);
        if (tab === "mentors") {
            exportToCSV(
                mentorRows.map((m) => ({
                    Mentor: m.name,
                    Email: m.email,
                    Phone: m.phone,
                    States: m.states.map(displayState),
                    Coordinator: m.coordinatorName,
                    "Weeks Missed": m.missingWeeks.length,
                    "Weeks Expected": m.expectedWeeks,
                    "Missed Weeks": m.missingWeeks,
                    "Unsubmitted Drafts": m.draftWeeks,
                    "Last Submitted Week": m.lastSubmittedWeek ?? "Never",
                })),
                `mentors-missing-reports-${stamp}`,
            );
        } else {
            exportToCSV(
                fellowRows.map((f) => ({
                    Fellow: f.name,
                    LGA: f.lga,
                    State: f.state ? displayState(f.state) : "Unknown",
                    Mentor: f.mentorName,
                    Reason: f.reason === "mentor_no_report" ? "Mentor submitted no report" : "Left out of mentor's reports",
                    "Mentor Weeks Reported": `${f.mentorReportedWeeks} of ${f.expectedWeeks}`,
                    "Last Session Recorded": f.lastSessionDate ? f.lastSessionDate.slice(0, 10) : "Never",
                })),
                `fellows-without-sessions-${stamp}`,
            );
        }
    };

    const stateOptions = [
        { label: "All states in scope", value: "" },
        ...(data?.scopeStates ?? []).map((s) => ({ label: displayState(s), value: s })),
    ];

    return (
        <>
            <Header
                title="Report Compliance"
                subtitle="Mentors who haven't submitted weekly reports, and fellows with no session recorded"
            />
            <div className="p-4 md:p-6 space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-lg border p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                        <Select
                            id="compliance-period"
                            label="Period"
                            options={PERIOD_OPTIONS}
                            value={period}
                            onChange={(e) => handlePeriod(e.target.value)}
                        />
                        <Input
                            id="compliance-from"
                            label="From week"
                            type="week"
                            placeholder="2026-W01"
                            value={fromWeek}
                            max={toWeek || undefined}
                            onChange={(e) => {
                                setPeriod("custom");
                                setFromWeek(e.target.value);
                            }}
                        />
                        <Input
                            id="compliance-to"
                            label="To week"
                            type="week"
                            placeholder="2026-W01"
                            value={toWeek}
                            min={fromWeek || undefined}
                            onChange={(e) => {
                                setPeriod("custom");
                                setToWeek(e.target.value);
                            }}
                        />
                        <Select
                            id="compliance-state"
                            label="State"
                            options={stateOptions}
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        {rangeInvalid
                            ? "The start week must not be after the end week."
                            : `${rangeLabel(weeks)}${weeks.length ? ` · ${weeks.length} week${weeks.length === 1 ? "" : "s"}` : ""}. Draft reports don't count as submitted; weeks before a mentor or fellow was added aren't counted against them.`}
                    </p>
                </div>

                {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

                {/* Summary */}
                {data && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <SummaryCard
                            label="Mentors missing a report"
                            value={data.summary.mentorsMissing}
                            of={data.summary.totalMentors}
                            tone="red"
                        />
                        <SummaryCard
                            label="Fellows with no session recorded"
                            value={data.summary.fellowsWithoutSessions}
                            of={data.summary.totalFellows}
                            tone="amber"
                        />
                    </div>
                )}

                {/* Tabs + table */}
                <div className="bg-white rounded-lg border">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-3">
                        <div className="flex gap-4">
                            {(
                                [
                                    ["mentors", "Mentors", data?.mentors.length],
                                    ["fellows", "Fellows", data?.fellows.length],
                                ] as const
                            ).map(([key, label, count]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTab(key)}
                                    className={cn(
                                        "pb-3 text-sm font-medium border-b-2 -mb-px",
                                        tab === key
                                            ? "border-orange-600 text-orange-700"
                                            : "border-transparent text-gray-500 hover:text-gray-800",
                                    )}
                                >
                                    {label}
                                    {count !== undefined && (
                                        <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{count}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pb-3">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={tab === "mentors" ? "Search mentor, email, coordinator…" : "Search fellow, LGA, mentor…"}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 h-9 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
                                />
                            </div>
                            {tab === "fellows" && (
                                <select
                                    aria-label="Reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="h-9 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
                                >
                                    {REASON_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={loading || !rows.length}
                                tooltip={`Download the ${rows.length} listed ${tab} as CSV`}
                            >
                                <FileDown className="h-4 w-4 mr-1" /> CSV
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {loading ? (
                            <p className="py-12 text-center text-sm text-gray-400">Loading…</p>
                        ) : !rows.length ? (
                            <p className="py-12 text-center text-sm text-gray-400">
                                {term || reason
                                    ? "Nothing matches this search."
                                    : tab === "mentors"
                                      ? "Every mentor in scope has submitted a report for this period."
                                      : "Every fellow in scope has a session recorded for this period."}
                            </p>
                        ) : tab === "mentors" ? (
                            <MentorTable rows={pageRows as ComplianceMentorItem[]} multiWeek={multiWeek} />
                        ) : (
                            <FellowTable rows={pageRows as ComplianceFellowItem[]} />
                        )}
                    </div>
                    {!loading && rows.length > 0 && (
                        <div className="border-t px-4 py-3">
                            <Pagination page={page} totalPages={totalPages} total={rows.length} onPageChange={setPage} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
