/* ──────────────────────────────────────────
   API: /api/reports/fellow-monthly/availability
   Can the logged-in mentor create a fellow monthly
   report for `month` (and, if given, `fellowId`)?

   Two things can block it:
     1. the month has not run past the 27th yet
     2. a report already exists for that fellow + month
   ────────────────────────────────────────── */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { UserRole } from "@/lib/constants";
import {
    MONTHLY_REPORT_UNLOCK_DAY,
    latestReportableMonth,
    monthLabel,
    monthLockReason,
    monthUnlockDate,
} from "@/lib/date-helpers";
import { format } from "date-fns";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== UserRole.MENTOR) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const month = (searchParams.get("month") || "").trim();
        const fellowId = searchParams.get("fellowId");

        if (!month) {
            return NextResponse.json({ error: "month is required." }, { status: 400 });
        }

        const lockReason = monthLockReason(month);
        const unlockDate = monthUnlockDate(month);

        const base = {
            month,
            latestReportableMonth: latestReportableMonth(),
            unlockDay: MONTHLY_REPORT_UNLOCK_DAY,
            locked: !!lockReason,
            lockReason,
            unlockDate: unlockDate ? format(unlockDate, "yyyy-MM-dd") : null,
            exists: false,
            existingReportId: null as string | null,
            existingIsMine: false,
            duplicateReason: null as string | null,
            fellowName: null as string | null,
        };

        // Drafts may be saved for a month that has not unlocked yet, so the
        // duplicate check has to run even when locked — only a missing fellow
        // means there is nothing to check.
        if (!fellowId) return NextResponse.json(base);

        await connectDB();

        const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
        if (!mentorDoc) return NextResponse.json({ error: "Mentor profile not found." }, { status: 403 });

        const fellowDoc = await Fellow.findById(fellowId).select("name").lean();
        if (!fellowDoc) return NextResponse.json({ error: "Fellow not found." }, { status: 404 });

        const existing = await MentorMonthlyReport.findOne({ fellow: fellowDoc._id, month })
            .select("_id mentor status")
            .lean();

        if (!existing) {
            return NextResponse.json({ ...base, fellowName: fellowDoc.name });
        }

        const mine = String(existing.mentor) === String(mentorDoc._id);
        const isDraft = existing.status === "draft";
        return NextResponse.json({
            ...base,
            fellowName: fellowDoc.name,
            exists: true,
            existingIsMine: mine,
            existingIsDraft: mine && isDraft,
            existingReportId: mine ? String(existing._id) : null,
            duplicateReason: mine
                ? isDraft
                    ? `You already have a draft for ${fellowDoc.name} for ${monthLabel(month)}. Open it from Drafts to continue.`
                    : `You have already submitted a report for ${fellowDoc.name} for ${monthLabel(month)}.`
                : `A report for ${fellowDoc.name} for ${monthLabel(month)} has already been submitted by another mentor.`,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
