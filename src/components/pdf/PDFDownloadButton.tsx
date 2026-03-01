/* ──────────────────────────────────────────
   PDF Download button (client component)
   Uses @react-pdf/renderer's BlobProvider
   ────────────────────────────────────────── */
"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { WeeklyReportPDF } from "./WeeklyReportPDF";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import type { Report } from "@/lib/api-client";
import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "@/components/ui/Button";

interface PDFDownloadButtonProps extends VariantProps<typeof buttonVariants>, React.ButtonHTMLAttributes<HTMLButtonElement> {
  report: Report;
  className?: string;
  children?: React.ReactNode;
}

export function PDFDownloadButton({ report, className, children, variant = "outline", size = "sm", ...rest }: PDFDownloadButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const blob = await pdf(<WeeklyReportPDF report={report} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Mentorship_Report_${report.weekKey}_${report.mentor?.name?.replace(/\s+/g, "_") ?? "report"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      variant={variant ?? "outline"}
      size={size ?? "sm"}
      onClick={handleDownload}
      disabled={generating}
      className={className}
      {...rest}
    >
      {children ?? (
        <>
          <Download className="h-4 w-4 mr-2" />
          {generating ? "Generating…" : "Download PDF"}
        </>
      )}
    </Button>
  );
}
