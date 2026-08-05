import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AppSettings } from "@/models";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { Mentor } from "@/models/Mentor";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { ReportHistory } from "@/models/ReportHistory";
import {
    UserRole,
    ReportHistoryReportType,
    ReportHistoryAction,
    normalizeLocation,
    resolveMentorStates,
    resolveStateForLGA,
} from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";
import { monthLockReason, monthLabel } from "@/lib/date-helpers";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const report = await MentorMonthlyReport.findById(id)
            .populate({ path: "mentor", populate: { path: "authId", select: "name email" } })
            .populate({ path: "fellow", select: "name lga qualification" })
            .lean();

        if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

        const role = session.user.role;

        if (role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc || (report as any).mentor?._id?.toString() !== mentorDoc._id.toString()) {
                return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
            }
        }

        if (role === UserRole.COORDINATOR) {
            const coordDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (!coordDoc) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
            const mentorOfReport = await Mentor.findById((report as any).mentor?._id).lean();
            if (mentorOfReport?.coordinator?.toString() !== coordDoc._id.toString()) {
                return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
            }
        }

        if (role === UserRole.ZONAL_DESK_OFFICER) {
            const deskOfficerDoc = await DeskOfficer.findOne({ authId: session.user.id }).lean();
            if (!deskOfficerDoc || !deskOfficerDoc.states?.length) {
                return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
            }
            const mentorOfReport = await Mentor.findById((report as any).mentor?._id).lean();
            const officerStates = deskOfficerDoc.states!.map((s) => normalizeLocation(s));
            const mentorStates = resolveMentorStates(mentorOfReport);
            // The report also belongs to the state its fellow's LGA sits in —
            // that may be a state the mentor's profile never listed.
            const fellowState = resolveStateForLGA((report as any).fellowLGA, mentorStates);
            const reportStates = [...new Set([...mentorStates, ...(fellowState ? [fellowState] : [])])];
            const hasOverlap = reportStates.some(s => officerStates.includes(s));
            if (!hasOverlap) {
                return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
            }
        }

        const settings =
            role === UserRole.MENTOR || role === UserRole.COORDINATOR
                ? await AppSettings.findOne({}).lean()
                : null;
        const canEdit =
            role === UserRole.ADMIN ||
            (role === UserRole.MENTOR && !settings?.blockMonthlyReportEdits?.mentor) ||
            (role === UserRole.COORDINATOR && !settings?.blockMonthlyReportEdits?.coordinator);

        return NextResponse.json({ ...(report as any), canEdit });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = session.user.role;
        if (role !== UserRole.MENTOR && role !== UserRole.COORDINATOR && role !== UserRole.ADMIN) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        await connectDB();
        const report = await MentorMonthlyReport.findById(id);
        if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

        if (role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc || report.mentor?.toString() !== mentorDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden." }, { status: 403 });
            }
        }

        if (role === UserRole.COORDINATOR) {
            const coordDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (!coordDoc) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
            const mentorDoc = await Mentor.findById(report.mentor).lean();
            if (!mentorDoc || mentorDoc.coordinator?.toString() !== coordDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden — this mentor is not assigned to you." }, { status: 403 });
            }
        }

        if (role !== UserRole.ADMIN) {
            const settings = await AppSettings.findOne({}).lean();
            if (settings) {
                if (role === UserRole.MENTOR && settings.blockMonthlyReportEdits?.mentor) {
                    return NextResponse.json({ error: "Monthly report editing is currently disabled." }, { status: 403 });
                }
                if (role === UserRole.COORDINATOR && settings.blockMonthlyReportEdits?.coordinator) {
                    return NextResponse.json({ error: "Monthly report editing is currently disabled." }, { status: 403 });
                }
            }
        }

        const snapshot = JSON.stringify(report.toObject());
        const body = await request.json();

        // Moving a report to another month must respect the same window and
        // one-report-per-fellow-per-month rule as creation.
        if (body.month !== undefined && String(body.month) !== report.month) {
            const month = String(body.month ?? "");
            const lockReason = monthLockReason(month);
            if (lockReason) {
                return NextResponse.json({ error: lockReason }, { status: 400 });
            }

            const duplicate = await MentorMonthlyReport.findOne({
                fellow: report.fellow,
                month,
                _id: { $ne: report._id },
            })
                .select("_id")
                .lean();
            if (duplicate) {
                return NextResponse.json(
                    {
                        error: `A report for ${report.fellowName} for ${monthLabel(month)} already exists.`,
                    },
                    { status: 409 }
                );
            }
        }

        Object.assign(report, body);
        await report.save();

        void ReportHistory.create({
            reportId: report._id,
            reportType: ReportHistoryReportType.MENTOR_MONTHLY_REPORT,
            action: ReportHistoryAction.UPDATED,
            snapshot,
            actorId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
        });

        void logActivity({
            session,
            action: "UPDATE_MENTOR_MONTHLY_REPORT",
            targetType: "MentorMonthlyReport",
            targetId: id,
            targetName: `${report.fellowName} – ${report.month}`,
        });

        return NextResponse.json(report);
    } catch (error: any) {
        if (error?.code === 11000) {
            return NextResponse.json(
                { error: "A report already exists for this fellow and month." },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const role = session.user.role;
        if (role !== UserRole.MENTOR && role !== UserRole.ADMIN) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        await connectDB();
        const report = await MentorMonthlyReport.findById(id).lean();
        if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

        if (role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc || report.mentor?.toString() !== mentorDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden." }, { status: 403 });
            }
        }

        await MentorMonthlyReport.findByIdAndDelete(id);

        void ReportHistory.create({
            reportId: id,
            reportType: ReportHistoryReportType.MENTOR_MONTHLY_REPORT,
            action: ReportHistoryAction.DELETED,
            snapshot: JSON.stringify(report),
            actorId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
        });

        void logActivity({
            session,
            action: "DELETE_MENTOR_MONTHLY_REPORT",
            targetType: "MentorMonthlyReport",
            targetId: id,
            targetName: `${report.fellowName} – ${report.month}`,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
