/* ──────────────────────────────────────────
   Monthly Reports List Page (Coordinators)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type MonthlyReport } from "@/lib/api-client";
import { Plus, Eye, FileText } from "lucide-react";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

export default function MonthlyReportsPage() {
    const [reports, setReports] = useState<MonthlyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const { data: session } = useSession();
    const userRole = session?.user?.role;
    const hideCreateAction = userRole === UserRole.COORDINATOR || userRole === UserRole.ZONAL_DESK_OFFICER;

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.reports.monthly.list({ limit: "50" });
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

    return (
        <>
            <Header title="Monthly Reports" subtitle="Aggregate weekly reports into a monthly summary" />

            <div className="p-6 space-y-4">
                <Card>
                    <CardContent className="pt-4 flex justify-between items-center sm:flex-row flex-col gap-4">
                        <div className="text-sm text-gray-600">
                            {total} report{total === 1 ? "" : "s"} found.
                        </div>
                        {!hideCreateAction && (
                            <Link href="/reports/monthly/new">
                                <Button size="sm">
                                    <Plus className="h-4 w-4 mr-1" /> New Monthly Report
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
                                <th className="px-4 py-3 font-medium text-gray-600">State</th>
                                <th className="px-4 py-3 font-medium text-gray-600 w-1/2">Summary Preview</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading reports…</td>
                                </tr>
                            ) : !reports.length ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <FileText className="h-8 w-8 text-gray-300" />
                                            <p>No monthly reports generated yet.</p>
                                            {!hideCreateAction && (
                                                <Link href="/reports/monthly/new">
                                                    <span className="text-green-600 hover:underline">Create your first monthly report</span>
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                reports.map((r) => {
                                    const displayMonth = format(parseISO(`${r.month}-01`), "MMMM yyyy");
                                    return (
                                        <tr key={r._id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{displayMonth}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.state}</td>
                                            <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">
                                                {r.summaryText}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link href={`/reports/monthly/${r._id}`}>
                                                    <Button variant="ghost" size="icon" aria-label="View Report">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
