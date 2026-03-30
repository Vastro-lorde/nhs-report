/* ──────────────────────────────────────────
   Fellow Monthly Report – Detail / View Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { pdf } from "@react-pdf/renderer";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api, type MentorMonthlyReport } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { ArrowLeft, Trash2, Loader2, Download } from "lucide-react";

const MentorMonthlyReportPDF = dynamic(
  () => import("@/components/pdf/MentorMonthlyReportPDF").then(m => m.MentorMonthlyReportPDF),
  { ssr: false }
);

const RATING_COLORS: Record<string, string> = {
  Excellent: "bg-green-100 text-green-800",
  Good: "bg-blue-100 text-blue-800",
  Fair: "bg-yellow-100 text-yellow-800",
  "Needs Improvement": "bg-red-100 text-red-800",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value ?? <span className="text-gray-400 italic">—</span>}</p>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  const filtered = items.filter(i => i.trim());
  if (!filtered.length) return <p className="text-sm text-gray-400 italic">None recorded.</p>;
  return (
    <ul className="list-disc list-inside space-y-1">
      {filtered.map((item, i) => (
        <li key={i} className="text-sm text-gray-800">{item}</li>
      ))}
    </ul>
  );
}

export default function MentorMonthlyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [report, setReport] = useState<MentorMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.reports.fellowMonthly.get(id);
        setReport(data);
      } catch (err: any) {
        setError(err.message ?? "Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const canDelete = userRole === UserRole.MENTOR || userRole === UserRole.ADMIN;

  const handleDownloadPDF = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const { MentorMonthlyReportPDF: PDFDoc } = await import("@/components/pdf/MentorMonthlyReportPDF");
      const displayMonth = format(parseISO(`${report.month}-01`), "MMMM yyyy");
      const mentorName = (report.mentor as any)?.authId?.name as string | undefined;
      const blob = await pdf(
        <PDFDoc report={report} monthLabel={displayMonth} mentorName={mentorName} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `MentorMonthlyReport_${report.month}_${report.fellowName.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.reports.fellowMonthly.delete(id);
      router.push("/reports/fellow-monthly");
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Fellow Monthly Report" />
        <div className="p-6 flex items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      </>
    );
  }

  if (error || !report) {
    return (
      <>
        <Header title="Fellow Monthly Report" />
        <div className="p-6 text-red-600">{error || "Report not found."}</div>
      </>
    );
  }

  const displayMonth = format(parseISO(`${report.month}-01`), "MMMM yyyy");
  const attendancePct =
    report.sessionsHeld > 0
      ? Math.round((report.sessionsAttended / report.sessionsHeld) * 100)
      : 0;

  return (
    <>
      <Header
        title={`Fellow Monthly Report – ${displayMonth}`}
        subtitle={`${report.fellowName} · ${report.fellowLGA}`}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push("/reports/fellow-monthly")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              {downloading ? "Generating…" : "Download PDF"}
            </Button>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          )}
          </div>
        </div>

        {/* Section 1 – Mentee Details */}
        <Section title="Section 1 – Mentee Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Full Name" value={report.fellowName} />
            <Field label="LGA" value={report.fellowLGA} />
            <Field label="Qualification" value={report.fellowQualification} />
            <Field label="Mentor" value={report.mentor?.authId?.name} />
          </div>
        </Section>

        {/* Section 2 – Attendance */}
        <Section title="Section 2 – Attendance">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Sessions Held" value={report.sessionsHeld} />
            <Field
              label="Sessions Attended"
              value={`${report.sessionsAttended} (${attendancePct}%)`}
            />
            <Field label="Sessions Absent" value={report.sessionsAbsent} />
          </div>
        </Section>

        {/* Section 3 – Monthly Summary */}
        <Section title="Section 3 – Monthly Summary">
          <div className="space-y-4">
            <Field label="Learning / Courses Completed" value={report.summaryLearning} />
            <Field label="PHC Visits / Community Engagements" value={report.summaryPhcVisits} />
            <Field label="Activities & Outcomes" value={report.summaryActivities} />
            <Field label="Fellow's Growth & Development" value={report.summaryGrowth} />
            <Field label="Impact of Mentoring" value={report.summaryImpact} />
          </div>
        </Section>

        {/* Section 4 – Key Challenges */}
        <Section title="Section 4 – Key Challenges">
          <BulletList items={report.challenges} />
        </Section>

        {/* Section 5 – Recommendations */}
        <Section title="Section 5 – Mentor's Recommendations">
          <BulletList items={report.recommendations} />
        </Section>

        {/* Section 6 – Progress Rating */}
        <Section title="Section 6 – Progress Rating">
          {report.progressRating ? (
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${RATING_COLORS[report.progressRating] ?? "bg-gray-100 text-gray-700"}`}
            >
              {report.progressRating}
            </span>
          ) : (
            <p className="text-sm text-gray-400 italic">Not rated.</p>
          )}
        </Section>

        {/* Section 7 – Key Achievements */}
        <Section title="Section 7 – Key Achievements">
          {report.achievements ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.achievements}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">None recorded.</p>
          )}
        </Section>

        <p className="text-xs text-gray-400 text-right">
          Submitted {format(parseISO(report.createdAt), "dd MMM yyyy, HH:mm")}
        </p>
      </div>
    </>
  );
}
