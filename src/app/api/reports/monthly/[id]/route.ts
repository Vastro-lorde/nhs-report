import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MonthlyReport } from "@/models/MonthlyReport";
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
        const coordAuthId = (report.coordinator as any)?.authId?._id?.toString() || report.coordinator?.toString();

        if (session.user.role === UserRole.COORDINATOR && session.user.id !== coordAuthId && session.user.state !== report.state) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        if (session.user.role === UserRole.MENTOR && session.user.id !== coordAuthId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

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

        return NextResponse.json({
            ...(report as any),
            weeklyReports: normalizedWeeklyReports,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
