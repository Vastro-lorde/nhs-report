/* ──────────────────────────────────────────
   Reports by Mentor — Admin & Coordinator only
   Tabs: Weekly | Mentor Monthly | Fellow Monthly
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye } from "lucide-react";

import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { UserRole } from "@/lib/constants";
import {
    api,
    type Mentor,
    type Report,
    type MonthlyReport,
    type MentorMonthlyReport,
} from "@/lib/api-client";
import { safeFormatISO, weekRangeLabelFromWeekKey } from "@/lib/date-helpers";

type TabKey = "weekly" | "monthly" | "fellowMonthly";

const TABS: { key: TabKey; label: string }[] = [
    { key: "weekly", label: "Weekly Reports" },
    { key: "monthly", label: "Mentor Monthly" },
    { key: "fellowMonthly", label: "Fellow Monthly" },
];

const RATING_COLORS: Record<string, string> = {
    Excellent: "bg-green-100 text-green-800",
    Good: "bg-blue-100 text-blue-800",
    Fair: "bg-yellow-100 text-yellow-800",
    "Needs Improvement": "bg-red-100 text-red-800",
};

export default function MentorReportsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const { data: session, status } = useSession();
    const role = session?.user?.role;
    const isAuthorized = role === UserRole.ADMIN || role === UserRole.COORDINATOR;

    const [mentor, setMentor] = useState<Mentor | null>(null);
    const [mentorLoading, setMentorLoading] = useState(true);
    const [mentorError, setMentorError] = useState("");

    const [activeTab, setActiveTab] = useState<TabKey>("weekly");

    const [weekly, setWeekly] = useState<Report[]>([]);
    const [weeklyPg, setWeeklyPg] = useState({ page: 1, totalPages: 1, total: 0 });
    const [weeklyPage, setWeeklyPage] = useState(1);

    const [monthly, setMonthly] = useState<MonthlyReport[]>([]);
    const [monthlyPg, setMonthlyPg] = useState({ page: 1, totalPages: 1, total: 0 });
    const [monthlyPage, setMonthlyPage] = useState(1);

    const [fellowMonthly, setFellowMonthly] = useState<MentorMonthlyReport[]>([]);
    const [fellowPg, setFellowPg] = useState({ page: 1, totalPages: 1, total: 0 });
    const [fellowPage, setFellowPage] = useState(1);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isAuthorized) return;
        let cancelled = false;
        (async () => {
            setMentorLoading(true);
            setMentorError("");
            try {
                const data = await api.mentors.get(id);
                if (!cancelled) setMentor(data);
            } catch (err) {
                if (!cancelled) setMentorError((err as Error).message);
            } finally {
                if (!cancelled) setMentorLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, isAuthorized]);

    const fetchWeekly = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.reports.list({
                page: String(weeklyPage),
                limit: "15",
                mentorId: id,
            });
            setWeekly(result.data);
            setWeeklyPg(result.pagination);
        } finally {
            setLoading(false);
        }
    }, [id, weeklyPage]);

    const fetchMonthly = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.reports.monthly.list({
                page: String(monthlyPage),
                limit: "15",
                mentorId: id,
            });
            setMonthly(result.data);
            setMonthlyPg(result.pagination);
        } finally {
            setLoading(false);
        }
    }, [id, monthlyPage]);

    const fetchFellowMonthly = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.reports.fellowMonthly.list({
                page: String(fellowPage),
                limit: "15",
                mentorId: id,
            });
            setFellowMonthly(result.data);
            setFellowPg(result.pagination);
        } finally {
            setLoading(false);
        }
    }, [id, fellowPage]);

    useEffect(() => {
        if (!isAuthorized) return;
        if (activeTab === "weekly") fetchWeekly();
        else if (activeTab === "monthly") fetchMonthly();
        else fetchFellowMonthly();
    }, [activeTab, isAuthorized, fetchWeekly, fetchMonthly, fetchFellowMonthly]);

    const mentorName = useMemo(() => mentor?.name ?? "Mentor", [mentor]);

    if (status === "loading") {
        return <div className="p-6 text-gray-500">Loading…</div>;
    }

    if (!isAuthorized) {
        return (
            <div className="p-6">
                <p className="text-red-600">You are not authorized to view this page.</p>
            </div>
        );
    }

    const statusBadge = (s: string) => {
        const variant = s === "submitted" ? "info" : s === "reviewed" ? "default" : "warning";
        return <Badge variant={variant}>{s}</Badge>;
    };

    return (
        <>
            <Header
                title="Mentor Reports"
                subtitle={mentorLoading ? "Loading…" : `All reports by ${mentorName}`}
            />

            <div className="p-6 space-y-4">
                <Button variant="ghost" onClick={() => router.push(`/mentors/${id}`)} className="mb-2">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Mentor Details
                </Button>

                {mentorError ? (
                    <p className="text-red-600">{mentorError}</p>
                ) : null}

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Report tabs">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key)}
                                className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition-colors ${activeTab === t.key
                                        ? "border-orange-600 text-orange-700"
                                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {activeTab === "weekly" && (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-left">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-600">Week</th>
                                            <th className="px-4 py-3 font-medium text-gray-600">State</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Sessions</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Mentees</th>
                                            <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                                            <th className="px-4 py-3 font-medium text-gray-600">Submitted</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading ? (
                                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                                        ) : !weekly.length ? (
                                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No weekly reports found.</td></tr>
                                        ) : (
                                            weekly.map((r) => (
                                                <tr key={r._id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">{weekRangeLabelFromWeekKey(r.weekKey)}</td>
                                                    <td className="px-4 py-3">{r.mentor?.state ?? r.state}</td>
                                                    <td className="px-4 py-3 hidden sm:table-cell">{r.sessionsCount}</td>
                                                    <td className="px-4 py-3 hidden sm:table-cell">{r.menteesCheckedIn}</td>
                                                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                                                    <td className="px-4 py-3">{format(new Date(r.createdAt), "MMM d, yyyy")}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link href={`/reports/${r._id}`}>
                                                            <Button variant="ghost" size="icon" aria-label="View Report">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                        <Pagination
                            page={weeklyPg.page}
                            totalPages={weeklyPg.totalPages}
                            total={weeklyPg.total}
                            onPrev={() => setWeeklyPage((p) => Math.max(1, p - 1))}
                            onNext={() => setWeeklyPage((p) => p + 1)}
                        />
                    </Card>
                )}

                {activeTab === "monthly" && (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-left">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                                            <th className="px-4 py-3 font-medium text-gray-600">State</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell w-1/2">Summary Preview</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading ? (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                                        ) : !monthly.length ? (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No mentor monthly reports found.</td></tr>
                                        ) : (
                                            monthly.map((r) => (
                                                <tr key={r._id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium">{safeFormatISO(r.month ? `${r.month}-01` : null, "MMMM yyyy")}</td>
                                                    <td className="px-4 py-3 text-gray-600">{r.state}</td>
                                                    <td className="px-4 py-3 text-gray-600 truncate max-w-75 hidden sm:table-cell">{r.summaryText}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link href={`/reports/monthly/${r._id}`}>
                                                            <Button variant="ghost" size="icon" aria-label="View Report">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                        <Pagination
                            page={monthlyPg.page}
                            totalPages={monthlyPg.totalPages}
                            total={monthlyPg.total}
                            onPrev={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                            onNext={() => setMonthlyPage((p) => p + 1)}
                        />
                    </Card>
                )}

                {activeTab === "fellowMonthly" && (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-left">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                                            <th className="px-4 py-3 font-medium text-gray-600">Fellow</th>
                                            <th className="px-4 py-3 font-medium text-gray-600">Sessions</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Rating</th>
                                            <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading ? (
                                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                                        ) : !fellowMonthly.length ? (
                                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No fellow monthly reports found.</td></tr>
                                        ) : (
                                            fellowMonthly.map((r) => {
                                                const pct = r.sessionsHeld > 0 ? Math.round((r.sessionsAttended / r.sessionsHeld) * 100) : 0;
                                                return (
                                                    <tr key={r._id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 font-medium">{safeFormatISO(r.month ? `${r.month}-01` : null, "MMMM yyyy")}</td>
                                                        <td className="px-4 py-3">{r.fellowName || r.fellow?.name || "—"}</td>
                                                        <td className="px-4 py-3 text-gray-600">
                                                            {r.sessionsAttended}/{r.sessionsHeld}
                                                            {r.sessionsHeld > 0 && (
                                                                <span className="ml-1 text-xs text-gray-400">({pct}%)</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 hidden sm:table-cell">
                                                            {r.progressRating ? (
                                                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RATING_COLORS[r.progressRating] ?? "bg-gray-100 text-gray-700"}`}>
                                                                    {r.progressRating}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Link href={`/reports/fellow-monthly/${r._id}`}>
                                                                <Button variant="ghost" size="icon" aria-label="View">
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                        <Pagination
                            page={fellowPg.page}
                            totalPages={fellowPg.totalPages}
                            total={fellowPg.total}
                            onPrev={() => setFellowPage((p) => Math.max(1, p - 1))}
                            onNext={() => setFellowPage((p) => p + 1)}
                        />
                    </Card>
                )}
            </div>
        </>
    );
}

function Pagination({
    page,
    totalPages,
    total,
    onPrev,
    onNext,
}: {
    page: number;
    totalPages: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
}) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between text-sm text-gray-500 px-4 py-3 border-t">
            <span>
                Page {page} of {totalPages} ({total} report{total === 1 ? "" : "s"})
            </span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
