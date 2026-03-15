/* ──────────────────────────────────────────
   Monthly Report Detail Page
   Supports Mentor and Zonal report types
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type MonthlyReport, type Report, monthlyReportAuthorName } from "@/lib/api-client";
import { ChevronLeft, FileDown, Eye, Calendar, User, Trash2 } from "lucide-react";
import Link from "next/link";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { weekRangeLabelFromDate } from "@/lib/date-helpers";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

export default function MonthlyReportDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [exporting, setExporting] = useState(false);

    const { data: session } = useSession();
    const canDelete = session?.user?.role === UserRole.COORDINATOR || session?.user?.role === UserRole.ADMIN;

    const contentRef = useRef<HTMLDivElement>(null);

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.reports.monthly.get(id);
            setReport(data);
        } catch (err: any) {
            setError(err.message || "Failed to load report");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleExportPDF = async () => {
        if (!contentRef.current || !report) return;
        setExporting(true);

        try {
            const element = contentRef.current;
            const imgData = await toPng(element, { pixelRatio: 2 });

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Failed to load generated image for PDF export"));
                img.src = imgData;
            });

            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (img.naturalHeight * pdfWidth) / img.naturalWidth;

            let heightLeft = imgHeight;
            let yOffset = 0;

            // First page
            pdf.addImage(imgData, "PNG", 0, yOffset, pdfWidth, imgHeight);
            heightLeft -= pdfPageHeight;

            // Add subsequent pages if content overflows
            while (heightLeft > 0) {
                yOffset -= pdfPageHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, yOffset, pdfWidth, imgHeight);
                heightLeft -= pdfPageHeight;
            }

            const typeLabel = report.type === "zonal" ? "Zonal" : "Mentor";
            pdf.save(`${typeLabel}_Monthly_Report_${report.state}_${report.month}.pdf`);
        } catch (err) {
            console.error("Failed to generate PDF", err);
            alert("Failed to export PDF.");
        } finally {
            setExporting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this monthly report? This action cannot be undone.")) return;
        try {
            await api.reports.monthly.delete(id);
            router.push("/reports/monthly");
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Report…</div>;
    }

    if (error || !report) {
        return <div className="p-8 text-center text-red-500">{error || "Report not found"}</div>;
    }

    const displayMonth = format(parseISO(`${report.month}-01`), "MMMM yyyy");
    const isZonal = report.type === "zonal";
    const authorName = monthlyReportAuthorName(report);
    const authorRole = isZonal ? "Zonal Coordinator" : "Mentor";

    return (
        <>
            <div className="flex items-center justify-between gap-4 px-6 pt-6 -mb-2">
                <Link href="/reports/monthly">
                    <Button variant="ghost" size="sm" className="-ml-3 text-gray-500 hover:text-gray-900">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                </Link>
                <div className="flex gap-2">
                    <Button onClick={handleExportPDF} disabled={exporting}>
                        <FileDown className="h-4 w-4 mr-2" />
                        {exporting ? "Generating PDF..." : "Export as PDF"}
                    </Button>
                    {canDelete && (
                        <Button variant="destructive" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            <Header title={isZonal ? `Zonal Monthly Summary: ${report.state}` : `Monthly Summary: ${report.state}`} />

            {/* The container that gets printed to PDF */}
            <div ref={contentRef} className="p-6 max-w-4xl space-y-8 bg-gray-50" style={{ padding: '2rem' }}>

                <Card className="border-none shadow-sm">
                    <CardHeader className={`text-white rounded-t-xl pb-6 ${isZonal ? "bg-blue-700" : "bg-orange-700"}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isZonal ? "bg-blue-200 text-blue-900" : "bg-orange-200 text-orange-900"}`}>
                                        {isZonal ? "Zonal Report" : "Mentor Report"}
                                    </span>
                                </div>
                                <CardTitle className="text-2xl mb-1">{displayMonth} Overview</CardTitle>
                                <p className={`font-medium ${isZonal ? "text-blue-100" : "text-orange-100"}`}>{authorRole}: {authorName}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${isZonal ? "text-blue-200" : "text-orange-200"}`}>Total Reports Aggregated</p>
                                <p className="text-3xl font-bold">{report.weeklyReports.length}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6 bg-white rounded-b-xl">
                        <div className="prose max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {report.summaryText}
                        </div>
                    </CardContent>
                </Card>

                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b">Included Weekly Reports</h3>

                    <div className="space-y-4">
                        {report.weeklyReports.map((wr: Report, i) => (
                            <Card key={wr._id} className="shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                                W{wr.weekNumber || (i + 1)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{wr.mentorName || (wr.mentor as any)?.authId?.name || (wr.mentor as any)?.name || "Unknown Mentor"}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" /> {weekRangeLabelFromDate(wr.weekEnding)}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center"><User className="h-3 w-3 mr-1" /> {wr.sessionsCount} Sessions</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Link href={`/reports/${wr._id}`} target="_blank" data-html2canvas-ignore="true">
                                            <Button variant="outline" size="sm">
                                                <Eye className="h-4 w-4 mr-1" /> View Full
                                            </Button>
                                        </Link>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                        {wr.keyWins && (
                                            <div className="bg-orange-50 p-3 rounded-md">
                                                <p className="font-semibold text-orange-800 mb-1">Key Wins</p>
                                                <p className="text-gray-700 whitespace-pre-wrap">{wr.keyWins}</p>
                                            </div>
                                        )}
                                        {wr.challenges && wr.challenges.length > 0 && (
                                            <div className="bg-red-50 p-3 rounded-md">
                                                <p className="font-semibold text-red-800 mb-1">Challenges</p>
                                                <ul className="list-disc list-inside text-gray-700">
                                                    {wr.challenges.map(c => <li key={c}>{c}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {report.weeklyReports.length === 0 && (
                            <div className="text-center p-8 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                                No weekly reports were found for this month.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </>
    );
}
