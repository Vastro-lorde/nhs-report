/* ──────────────────────────────────────────
   Saved Zonal Audit Detail Page
   View a single AI-generated zonal audit
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type SavedZonalAudit } from "@/lib/api-client";
import { ChevronLeft, Download, Trash2, Pencil, Save, X } from "lucide-react";
import { safeFormatISO } from "@/lib/date-helpers";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";
import ZonalAuditPreview from "@/components/reports/ZonalAuditPreview";
import type { IZonalAuditReport } from "@/types/zonal-audit";
import { exportElementToPdf } from "@/lib/pdf-export";

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export default function ZonalAuditDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [audit, setAudit] = useState<SavedZonalAudit | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editableData, setEditableData] = useState<IZonalAuditReport | null>(null);
    const [saving, setSaving] = useState(false);
    const auditRef = useRef<HTMLDivElement>(null);

    const { data: session } = useSession();
    const canDelete = session?.user?.role === UserRole.COORDINATOR || session?.user?.role === UserRole.ADMIN;

    const fetchAudit = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.reports.zonalAudits.get(id);
            setAudit(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load audit"));
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
            await exportElementToPdf(auditRef.current, {
                filename: `Zonal_Audit_${audit.zoneName?.replace(/\s+/g, "_")}_${audit.month}.pdf`,
            });
        } catch (err) {
            console.error("PDF generation failed:", err);
        } finally {
            setPdfGenerating(false);
        }
    };

    const handleStartEdit = () => {
        if (!audit) return;
        setEditableData(JSON.parse(JSON.stringify(audit.auditData)));
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditableData(null);
    };

    const handleSave = async () => {
        if (!editableData) return;
        setSaving(true);
        try {
            const updated = await api.reports.zonalAudits.update(id, { auditData: editableData });
            setAudit(updated);
            setIsEditing(false);
            setEditableData(null);
        } catch (err: unknown) {
            alert(`Failed to save: ${getErrorMessage(err, "Request failed")}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this zonal audit? This action cannot be undone.")) return;
        try {
            await api.reports.zonalAudits.delete(id);
            router.push("/reports/zonal-audits");
        } catch (err: unknown) {
            alert(`Failed to delete: ${getErrorMessage(err, "Request failed")}`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Audit…</div>;
    }

    if (error || !audit) {
        return <div className="p-8 text-center text-red-500">{error || "Audit not found"}</div>;
    }

    const displayMonth = safeFormatISO(audit.month ? `${audit.month}-01` : null, "MMMM yyyy");
    const canEdit = !!audit.canEdit;

    return (
        <>
            <div className="flex items-center justify-between gap-4 px-6 pt-6 -mb-2">
                <Link href="/reports/zonal-audits" data-tooltip="Return to zonal audits list">
                    <Button variant="ghost" size="sm" className="-ml-3 text-gray-500 hover:text-gray-900" tooltip="Return to zonal audits list">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                </Link>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <Button onClick={handleSave} disabled={saving} tooltip="Save modifications to this zonal audit">
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? "Saving…" : "Save Changes"}
                            </Button>
                            <Button variant="outline" onClick={handleCancelEdit} disabled={saving} tooltip="Cancel editing and revert changes">
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={handleDownloadPDF} disabled={pdfGenerating} tooltip="Export zonal audit as a formatted PDF">
                                <Download className="h-4 w-4 mr-2" />
                                {pdfGenerating ? "Generating PDF…" : "Download PDF"}
                            </Button>
                            {canEdit && (
                                <Button variant="outline" onClick={handleStartEdit} tooltip="Edit the contents of this zonal audit">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            )}
                            {canDelete && (
                                <Button variant="destructive" onClick={handleDelete} tooltip="Permanently delete this zonal audit">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <Header title={`Zonal Audit: ${audit.zoneName}`} subtitle={`${displayMonth} — Coordinator: ${audit.coordinator?.name || "Unknown"}`} />

            <div className="p-6 max-w-4xl space-y-6">
                <div ref={auditRef}>
                <Card>
                    <CardHeader className="bg-blue-700 text-white rounded-t-xl pb-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-200 text-blue-900">
                                        Zonal Audit
                                    </span>
                                </div>
                                <CardTitle className="text-2xl mb-1">{audit.zoneName} — {displayMonth}</CardTitle>
                                <p className="text-blue-100 font-medium">Coordinator: {audit.coordinator?.name || "Unknown"}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wider font-semibold mb-1 text-blue-200">Saved</p>
                                <p className="text-sm font-medium">{safeFormatISO(audit.createdAt, "dd MMM yyyy")}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 bg-white rounded-b-xl">
                        <ZonalAuditPreview
                            data={isEditing && editableData ? editableData : audit.auditData}
                            readOnly={!isEditing}
                            onChange={isEditing ? setEditableData : undefined}
                        />
                    </CardContent>
                </Card>
                </div>
            </div>
        </>
    );
}
