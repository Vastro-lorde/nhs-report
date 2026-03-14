import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MonthlyReport } from "@/models/MonthlyReport";
import { Mentor } from "@/models/Mentor";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { UserRole } from "@/lib/constants";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const report = await MonthlyReport.findById(id)
            .populate({
                path: "coordinator",
                populate: {
                    path: "authId",
                    select: "name email state"
                }
            })
            .populate({
                path: "mentor",
                populate: [
                    { path: "authId", select: "name email state" },
                    { path: "coordinator" },
                ]
            })
            .populate({
                path: "weeklyReports",
                populate: {
                    path: "mentor",
                    populate: {
                        path: "authId",
                        select: "name email state"
                    }
                },
            })
            .lean();

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Role-based access control
        const role = session.user.role;

        if (role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id });
            if (!mentorDoc) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
            // Mentors can see their own mentor reports and their coordinator's zonal reports
            const isMentorReport = report.type === "mentor" && (report as any).mentor?._id?.toString() === mentorDoc._id.toString();
            const isCoordZonalReport = report.type === "zonal" && (report as any).coordinator?._id?.toString() === mentorDoc.coordinator?.toString();
            if (!isMentorReport && !isCoordZonalReport) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
        }

        if (role === UserRole.COORDINATOR) {
            const coordDoc = await Coordinator.findOne({ authId: session.user.id });
            if (!coordDoc) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
            // Coordinators can see their own zonal reports and mentor reports from their mentors
            const isOwnZonal = report.type === "zonal" && (report as any).coordinator?._id?.toString() === coordDoc._id.toString();
            const isMentorUnderThem = report.type === "mentor"
                && (report as any).mentor?.coordinator?._id?.toString() === coordDoc._id.toString();
            if (!isOwnZonal && !isMentorUnderThem) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
        }

        if (role === UserRole.ZONAL_DESK_OFFICER) {
            const deskDoc = await DeskOfficer.findOne({ authId: session.user.id });
            if (!deskDoc || !deskDoc.states?.includes(report.state)) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
        }

        // Admin, ME Officer, Team Research Lead — unrestricted access

        const normalizedWeeklyReports = ((report as any).weeklyReports ?? []).map((wr: any) => {
            const mentorDoc = wr?.mentor;
            const mentorUser = mentorDoc?.authId;
            const mentorName = mentorUser?.name;
            const mentorEmail = mentorUser?.email;
            const mentorState = mentorDoc?.states?.[0] ?? wr?.state ?? "";

            return {
                ...wr,
                state: mentorState,
                mentorName,
                mentor: mentorDoc
                    ? {
                        _id: mentorDoc._id,
                        name: mentorName,
                        email: mentorEmail,
                        state: mentorState,
                    }
                    : wr?.mentor,
            };
        });

        // Normalize the top-level mentor/coordinator for client
        const normalized: any = { ...(report as any), weeklyReports: normalizedWeeklyReports };

        if (report.type === "mentor" && (report as any).mentor?.authId) {
            const m = (report as any).mentor;
            normalized.mentor = {
                _id: m._id,
                name: m.authId?.name,
                email: m.authId?.email,
                state: m.states?.[0] ?? "",
            };
        }

        if ((report as any).coordinator?.authId) {
            const c = (report as any).coordinator;
            normalized.coordinator = {
                _id: c._id,
                name: c.authId?.name,
                email: c.authId?.email,
                state: c.states?.[0] ?? "",
            };
        }

        return NextResponse.json(normalized);
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
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== UserRole.COORDINATOR) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await connectDB();

        const report = await MonthlyReport.findById(id).lean();
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const coordDoc = await Coordinator.findOne({ authId: session.user.id });
        if (!coordDoc) {
            return NextResponse.json({ error: "Coordinator profile not found" }, { status: 403 });
        }

        // Coordinators can delete their own zonal reports
        const isOwnZonal = report.type === "zonal"
            && report.coordinator?.toString() === coordDoc._id.toString();

        // Coordinators can delete mentor reports from mentors assigned to them
        let isMentorUnderThem = false;
        if (report.type === "mentor" && report.mentor) {
            const mentorDoc = await Mentor.findById(report.mentor).lean();
            isMentorUnderThem = mentorDoc?.coordinator?.toString() === coordDoc._id.toString();
        }

        if (!isOwnZonal && !isMentorUnderThem) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await MonthlyReport.findByIdAndDelete(id);

        return NextResponse.json({ message: "Monthly report deleted" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
