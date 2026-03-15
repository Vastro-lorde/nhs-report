/* ──────────────────────────────────────────
   Create Monthly Report Page
   Supports Mentor and Coordinator roles
   ────────────────────────────────────────── */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api-client";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

export default function NewMonthlyReportPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const userRole = session?.user?.role;
    const isMentor = userRole === UserRole.MENTOR;

    // Default to current month e.g., "2025-08"
    const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
    const [summaryText, setSummaryText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await api.reports.monthly.create({ month, summaryText });
            router.push(`/reports/monthly/${res._id}`);
        } catch (err: any) {
            setError(err.message || "Failed to create report.");
        } finally {
            setLoading(false);
        }
    };

    const reportTypeLabel = isMentor ? "Mentor Monthly Report" : "Zonal Monthly Report";
    const reportDescription = isMentor
        ? "Compile your own weekly reports into a monthly summary"
        : "Aggregate all mentors' weekly reports in your zone into a monthly summary";

    return (
        <>
            <div className="flex items-center gap-4 px-6 pt-6 -mb-2">
                <Link href="/reports/monthly">
                    <Button variant="ghost" size="sm" className="-ml-3 text-gray-500 hover:text-gray-900">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                </Link>
            </div>

            <Header title={`New ${reportTypeLabel}`} subtitle={reportDescription} />

            <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm font-medium">
                        {error}
                    </div>
                )}

                <Card>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Target Month</label>
                            <p className="text-xs text-gray-500 mb-2">
                                Select the month you want to summarize. This will automatically pull in all
                                submitted weekly reports{isMentor ? " from your sessions" : " from all mentors in your zone"} within this timeframe.
                            </p>
                            <Input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Monthly Summary</label>
                            <p className="text-xs text-gray-500 mb-2">
                                {isMentor
                                    ? "Write a high-level overview of your mentoring activities, successes, and challenges for the month."
                                    : "Write a high-level overview of the mentoring activities, successes, and challenges observed across your zone for the month."}
                            </p>
                            <textarea
                                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                                placeholder={isMentor
                                    ? "This month I focused on building rapport with my mentees..."
                                    : "Our state saw tremendous growth in mentee check-ins this month..."}
                                value={summaryText}
                                onChange={(e) => setSummaryText(e.target.value)}
                                required
                            />
                        </div>

                        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg">
                            <strong>Note:</strong> Generating this report will snapshot the current weekly reports.
                            Any weekly reports submitted or edited after this point will not be retroactively included.
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button type="submit" size="lg" disabled={loading}>
                        {loading ? "Aggregating Data..." : `Generate ${reportTypeLabel}`}
                    </Button>
                </div>
            </form>
        </>
    );
}
