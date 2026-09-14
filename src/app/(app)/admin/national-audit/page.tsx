/* ──────────────────────────────────────────
   National Audit List Page
   Generate and view AI-powered national federal
   oversight audit reports.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type SavedNationalAudit } from "@/lib/api-client";
import { safeFormatISO } from "@/lib/date-helpers";
import { Eye, ClipboardList, Trash2, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

export default function NationalAuditPage() {
    const [audits, setAudits] = useState<SavedNationalAudit[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const [month, setMonth] = useState("");
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState("");

    const { data: session } = useSession();
    const userRole = session?.user?.role;
    const isAdmin = userRole === UserRole.ADMIN;

    /* ── Fetch saved audits ───────────── */
    const fetchAudits = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.reports.nationalAudit.list({ limit: "50" });
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

    /* ── Generate + auto-save ─────────── */
    const handleGenerate = async () => {
        if (!month) return;
        setGenerating(true);
        setGenError("");
        try {
            const auditData = await api.reports.nationalAudit.generate({ month });
            await api.reports.nationalAudit.save({ month, auditData });
            await fetchAudits();
        } catch (err: any) {
            setGenError(err.message || "Generation failed");
        } finally {
            setGenerating(false);
        }
    };

    /* ── Delete ───────────────────────── */
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this national audit? This action cannot be undone.")) return;
        try {
            await api.reports.nationalAudit.delete(id);
            fetchAudits();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    return (
        <>
            <Header title="National Audit" subtitle="AI-generated national federal oversight reports" />

            <div className="p-6 space-y-4">
                {/* ── Generate Card (admin only) ── */}
                {isAdmin && (
                    <Card>
                        <CardContent className="pt-4 flex flex-col sm:flex-row items-start sm:items-end gap-4">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="audit-month" className="text-sm font-medium text-gray-700">
                                    Reporting Month
                                </label>
                                <input
                                    id="audit-month"
                                    type="month"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <Button onClick={handleGenerate} disabled={!month || generating} tooltip="Analyze and generate AI-powered national audit">
                                {generating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating…
                                    </>
                                ) : (
                                    "Generate National Audit"
                                )}
                            </Button>
                        </CardContent>
                        {genError && (
                            <CardContent className="pt-0">
                                <p className="text-sm text-red-600">{genError}</p>
                            </CardContent>
                        )}
                    </Card>
                )}

                {/* ── Summary ── */}
                <Card>
                    <CardContent className="pt-4 flex justify-between items-center sm:flex-row flex-col gap-4">
                        <div className="text-sm text-gray-600">
                            {total} audit{total === 1 ? "" : "s"} found.
                        </div>
                    </CardContent>
                </Card>

                {/* ── Table ── */}
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600">Month</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Generated By</th>
                                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Created</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading audits…</td>
                                </tr>
                            ) : !audits.length ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <ClipboardList className="h-8 w-8 text-gray-300" />
                                            <p>No national audits saved yet.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                audits.map((a) => {
                                    const displayMonth = safeFormatISO(a.month ? `${a.month}-01` : null, "MMMM yyyy");
                                    return (
                                        <tr key={a._id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">
                                                <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800">
                                                    {displayMonth}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{a.generatedBy?.name || "Unknown"}</td>
                                            <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                                                {safeFormatISO(a.createdAt, "dd MMM yyyy")}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Link href={`/admin/national-audit/${a._id}`} data-tooltip="View national audit report">
                                                        <Button variant="ghost" size="icon" aria-label="View Audit" tooltip="View national audit report">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    {isAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Delete Audit"
                                                            onClick={() => handleDelete(a._id)}
                                                            tooltip="Permanently delete national audit"
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
