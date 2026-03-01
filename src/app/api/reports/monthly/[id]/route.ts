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
            .populate("coordinator", "name email state")
            .populate({
                path: "weeklyReports",
                populate: {
                    path: "mentor",
                    select: "name email state lgas",
                },
            })
            .lean();

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Role-based access control
        if (session.user.role === UserRole.COORDINATOR && session.user.id !== report.coordinator._id.toString() && session.user.state !== report.state) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        if (session.user.role === UserRole.MENTOR && session.user.id !== report.coordinator._id.toString()) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        return NextResponse.json(report);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
