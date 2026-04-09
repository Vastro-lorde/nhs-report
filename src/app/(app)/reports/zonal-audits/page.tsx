/* ──────────────────────────────────────────
   Saved Zonal Audits List Page
   Shows AI-generated zonal audit reports
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type SavedZonalAudit } from "@/lib/api-client";
import { safeFormatISO } from "@/lib/date-helpers";
import { Eye, ClipboardList, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

export default function ZonalAuditsPage() {
    const [audits, setAudits] = useState<SavedZonalAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const { data: session } = useSession();
    const userRole = session?.user?.role;
    const canDelete = userRole === UserRole.COORDINATOR || userRole === UserRole.ADMIN;

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this zonal audit? This action cannot be undone.")) return;
        try {
            await api.reports.zonalAudits.delete(id);
            fetchAudits();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const fetchAudits = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.reports.zonalAudits.list({ limit: "50" });
            setAudits(result.data);
            setTotal(result.pagination.total);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAudits();
    }, [fetchAudits]);

    return (
        <>
            <Header title="Zonal Audits" subtitle="AI-generated zonal performance audit reports" />

            <div className="p-6 space-y-4">
                <Card>
                    <CardContent className="pt-4 flex justify-between items-center sm:flex-row flex-col gap-4">
                        <div className="text-sm text-gray-600">
                            {total} audit{total === 1 ? "" : "s"} found.
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600">Zone</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Coordinator</th>
                                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Created</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading audits…</td>
                                </tr>
                            ) : !audits.length ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <ClipboardList className="h-8 w-8 text-gray-300" />
                                            <p>No zonal audits saved yet.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                audits.map((a) => {
                                    const displayMonth = safeFormatISO(a.month ? `${a.month}-01` : null, "MMMM yyyy");
                                    return (
                                        <tr key={a._id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">
                                                <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                                                    {a.zoneName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{displayMonth}</td>
                                            <td className="px-4 py-3 text-gray-600">{a.coordinator?.name || "Unknown"}</td>
                                            <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                                                {safeFormatISO(a.createdAt, "dd MMM yyyy")}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Link href={`/reports/zonal-audits/${a._id}`}>
                                                        <Button variant="ghost" size="icon" aria-label="View Audit">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    {canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Delete Audit"
                                                            onClick={() => handleDelete(a._id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-600" />
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
