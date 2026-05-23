/* ──────────────────────────────────────────
   Periodic National Audit Detail Page
   View a single multi-month national audit.
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import NationalAuditPeriodPreview from "@/components/reports/NationalAuditPeriodPreview";
import { api, type SavedNationalAuditPeriod } from "@/lib/api-client";
import { safeFormatISO } from "@/lib/date-helpers";
import { UserRole } from "@/lib/constants";
import { ChevronLeft, Download, Trash2 } from "lucide-react";

function filenameCode(value: string) {
  return value.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "-");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CoverageSummary({ audit }: { audit: SavedNationalAuditPeriod }) {
  const missingCount = audit.coverage.missingPairs.length;

  return (
    <div className="rounded-md border bg-gray-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Coverage</p>
          <p className="text-sm text-gray-600">
            {audit.coverage.presentZoneMonths}/{audit.coverage.expectedZoneMonths} zone-months available
          </p>
        </div>
        <span className={missingCount ? "text-sm font-medium text-amber-700" : "text-sm font-medium text-emerald-700"}>
          {missingCount ? `${missingCount} missing` : "Complete"}
        </span>
      </div>
      {missingCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {audit.coverage.missingPairs.map((pair) => (
            <span
              key={`${pair.zoneName}-${pair.month}`}
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              {pair.zoneName} / {pair.month}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PeriodicNationalAuditDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [audit, setAudit] = useState<SavedNationalAuditPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const auditRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.reports.nationalAuditPeriod.get(id);
      setAudit(data);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load audit"));
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

      doc.save(`National_Audit_${audit.startMonth}_to_${audit.endMonth}_${filenameCode(audit.periodLabel)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this periodic national audit? This action cannot be undone.")) return;
    try {
      await api.reports.nationalAuditPeriod.delete(id);
      router.push("/admin/national-audit-period");
    } catch (err: unknown) {
      alert(`Failed to delete: ${errorMessage(err, "Delete failed")}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Audit...</div>;
  }

  if (error || !audit) {
    return <div className="p-8 text-center text-red-500">{error || "Audit not found"}</div>;
  }

  return (
    <>
      <div className="-mb-2 flex items-center justify-between gap-4 px-6 pt-6">
        <Link href="/admin/national-audit-period">
          <Button variant="ghost" size="sm" className="-ml-3 text-gray-500 hover:text-gray-900">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button onClick={handleDownloadPDF} disabled={pdfGenerating}>
            <Download className="mr-2 h-4 w-4" />
            {pdfGenerating ? "Generating PDF" : "Download PDF"}
          </Button>
          {isAdmin && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Header title="Periodic National Audit" subtitle={`${audit.periodLabel} - Generated by: ${audit.generatedBy?.name || "Unknown"}`} />

      <div className="max-w-4xl space-y-6 p-6">
        <CoverageSummary audit={audit} />

        <div ref={auditRef}>
          <Card>
            <CardHeader className="rounded-t-xl bg-blue-700 pb-6 text-white">
              <div className="flex justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block rounded-full bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-900">
                      Periodic National Audit
                    </span>
                  </div>
                  <CardTitle className="mb-1 text-2xl text-white">Federal Oversight Report - {audit.periodLabel}</CardTitle>
                  <p className="font-medium text-blue-100">Generated by: {audit.generatedBy?.name || "Unknown"}</p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-200">Saved</p>
                  <p className="text-sm font-medium">{safeFormatISO(audit.createdAt, "dd MMM yyyy")}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="rounded-b-xl bg-white pt-6">
              <NationalAuditPeriodPreview data={audit.auditData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
