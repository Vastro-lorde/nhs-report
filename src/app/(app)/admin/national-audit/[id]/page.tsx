/* ──────────────────────────────────────────
   National Audit Detail Page
   View a single AI-generated national audit
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type SavedNationalAudit } from "@/lib/api-client";
import { ChevronLeft, Download, Trash2 } from "lucide-react";
import { safeFormatISO } from "@/lib/date-helpers";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";
import NationalAuditPreview from "@/components/reports/NationalAuditPreview";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export default function NationalAuditDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [audit, setAudit] = useState<SavedNationalAudit | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const auditRef = useRef<HTMLDivElement>(null);

    const { data: session } = useSession();
    const isAdmin = session?.user?.role === UserRole.ADMIN;

    const fetchAudit = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.reports.nationalAudit.get(id);
            setAudit(data);
        } catch (err: any) {
            setError(err.message || "Failed to load audit");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

    const handleDownloadPDF = async () => {
        if (!audit || !auditRef.current) return;
        setPdfGenerating(true);
        try {
            const element = auditRef.current;
            const imgData = await toPng(element, { pixelRatio: 2 });

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Failed to load generated image for PDF export"));
                img.src = imgData;
            });

            const doc = new jsPDF("p", "mm", "a4");
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (img.naturalHeight * pdfWidth) / img.naturalWidth;
            const pageHeight = doc.internal.pageSize.getHeight();

            if (pdfHeight <= pageHeight) {
                doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            } else {
                let position = 0;
                let remaining = pdfHeight;
                while (remaining > 0) {
                    doc.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
                    remaining -= pageHeight;
                    position -= pageHeight;
                    if (remaining > 0) doc.addPage();
                }
            }

            doc.save(`National_Audit_${audit.month}.pdf`);
        } catch (err) {
            console.error("PDF generation failed:", err);
        } finally {
            setPdfGenerating(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this national audit? This action cannot be undone.")) return;
        try {
            await api.reports.nationalAudit.delete(id);
            router.push("/admin/national-audit");
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Audit…</div>;
    }

    if (error || !audit) {
        return <div className="p-8 text-center text-red-500">{error || "Audit not found"}</div>;
    }

    const displayMonth = safeFormatISO(audit.month ? `${audit.month}-01` : null, "MMMM yyyy");

    return (
        <>
            <div className="flex items-center justify-between gap-4 px-6 pt-6 -mb-2">
                <Link href="/admin/national-audit" data-tooltip="Return to national audits list">
                    <Button variant="ghost" size="sm" className="-ml-3 text-gray-500 hover:text-gray-900" tooltip="Return to national audits list">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                </Link>
                <div className="flex gap-2">
                    <Button onClick={handleDownloadPDF} disabled={pdfGenerating} tooltip="Export national audit report as PDF">
                        <Download className="h-4 w-4 mr-2" />
                        {pdfGenerating ? "Generating PDF…" : "Download PDF"}
                    </Button>
                    {isAdmin && (
                        <Button variant="destructive" onClick={handleDelete} tooltip="Permanently delete national audit report">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            <Header title="National Federal Oversight Report" subtitle={`${displayMonth} — Generated by: ${audit.generatedBy?.name || "Unknown"}`} />

            <div className="p-6 max-w-4xl space-y-6">
                <div ref={auditRef}>
                    <Card>
                        <CardHeader className="bg-blue-700 text-white rounded-t-xl pb-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-200 text-blue-900">
                                            National Audit
                                        </span>
                                    </div>
                                    <CardTitle className="text-2xl mb-1">Federal Oversight Report — {displayMonth}</CardTitle>
                                    <p className="text-blue-100 font-medium">Generated by: {audit.generatedBy?.name || "Unknown"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs uppercase tracking-wider font-semibold mb-1 text-blue-200">Saved</p>
                                    <p className="text-sm font-medium">{safeFormatISO(audit.createdAt, "dd MMM yyyy")}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 bg-white rounded-b-xl">
                            <NationalAuditPreview data={audit.auditData} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
