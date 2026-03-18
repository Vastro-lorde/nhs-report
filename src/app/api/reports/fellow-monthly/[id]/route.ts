import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { Mentor } from "@/models/Mentor";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { UserRole } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";

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
            const mentorStates: string[] = (mentorOfReport as any)?.states ?? [];
            const hasOverlap = mentorStates.some(s => deskOfficerDoc.states!.includes(s));
            if (!hasOverlap) {
                return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
            }
        }

        return NextResponse.json(report);
    } catch (error: any) {
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
