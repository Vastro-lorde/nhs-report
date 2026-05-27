import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { WeeklyReport } from "@/models/WeeklyReport";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { UserRole } from "@/lib/constants";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { getSundaysInMonth } from "@/lib/date-helpers";

/**
 * GET /api/reports/fellow-monthly/prefill?fellowId=X&month=2026-03
 *
 * Returns pre-filled data derived from the mentor's weekly reports for the given
 * fellow in the given month.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== UserRole.MENTOR) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const fellowId = searchParams.get("fellowId");
        const month = searchParams.get("month"); // e.g. "2026-03"

        if (!fellowId || !month) {
            return NextResponse.json({ error: "fellowId and month are required." }, { status: 400 });
        }

        await connectDB();

        const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
        if (!mentorDoc) return NextResponse.json({ error: "Mentor profile not found." }, { status: 403 });

        const fellowDoc = await Fellow.findOne({ _id: fellowId, mentor: mentorDoc._id }).lean();
        if (!fellowDoc) return NextResponse.json({ error: "Fellow not found." }, { status: 404 });

        // Date range for the month
        const monthStart = startOfMonth(parseISO(`${month}-01`));
        const monthEnd = endOfMonth(parseISO(`${month}-01`));

        // Fetch all weekly reports for this mentor in the month
        const weeklyReports = await WeeklyReport.find({
            mentor: mentorDoc._id,
            weekEnding: { $gte: monthStart, $lte: monthEnd },
        }).lean();

        const weeklyReportIds = weeklyReports.map((r) => r._id);

        // Sessions matching this fellow by name (case-insensitive)
        const fellowNameLower = fellowDoc.name.toLowerCase().trim();
        const matchingSessions = weeklyReports.flatMap((wr) =>
            (wr.sessions || []).filter(
                (s) => s.menteeName.toLowerCase().trim() === fellowNameLower
            )
        );

        const sundaysCount = getSundaysInMonth(month);
        const sessionsAttended = Math.min(sundaysCount, matchingSessions.length);
        const sessionsAbsent = Math.max(0, sundaysCount - sessionsAttended);

        // Deduplicated challenges from all matching sessions
        const challengeSet = new Set<string>();
        for (const s of matchingSessions) {
            for (const c of s.challenges || []) {
                if (c.trim()) challengeSet.add(c.trim());
            }
        }
        // Also pull top-level weekly challenges from weeks where this fellow was checked in
        const weeksWithFellow = weeklyReports.filter((wr) =>
            (wr.fellows || []).some((f) => f.name.toLowerCase().trim() === fellowNameLower)
        );
        for (const wr of weeksWithFellow) {
            for (const c of wr.challenges || []) {
                if (c.trim()) challengeSet.add(c.trim());
            }
        }

        // Deduplicated solutions from all matching sessions → prepopulate recommendations
        const solutionSet = new Set<string>();
        for (const s of matchingSessions) {
            for (const sol of s.solutions || []) {
                if (sol.trim()) solutionSet.add(sol.trim());
            }
        }

        return NextResponse.json({
            fellow: {
                _id: fellowDoc._id,
                name: fellowDoc.name,
                lga: fellowDoc.lga,
                qualification: (fellowDoc as any).qualification || "",
            },
            sessionsHeld: sundaysCount,
            sessionsAttended,
            sessionsAbsent,
            challenges: Array.from(challengeSet),
            recommendations: Array.from(solutionSet),
            weeklyReportIds,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
