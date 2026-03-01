import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MonthlyReport } from "@/models/MonthlyReport";
import { WeeklyReport } from "@/models/WeeklyReport";
import { Coordinator } from "@/models/Coordinator";
import { Mentor } from "@/models/Mentor";
import { UserRole } from "@/lib/constants";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        const filter: Record<string, any> = {};

        // If Coordinator, only see own states
        let coordinatorDocId = null;
        if (session.user.role === UserRole.COORDINATOR) {
            const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
            if (coordinatorDoc) {
                coordinatorDocId = coordinatorDoc._id;
                filter.coordinator = coordinatorDocId;
            }
        }

        // If Mentor, only see own reports (those of their coordinator)
        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id });
            if (mentorDoc) {
                filter.coordinator = mentorDoc.coordinator;
            }
        }

        const [data, total] = await Promise.all([
            MonthlyReport.find(filter)
                .populate("coordinator", "name email")
                .sort({ month: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MonthlyReport.countDocuments(filter),
        ]);

        return NextResponse.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== UserRole.COORDINATOR && session.user.role !== UserRole.MENTOR)) {
            return NextResponse.json({ error: "Unauthorized. Only Coordinators and Mentors can submit." }, { status: 401 });
        }

        await connectDB();
        const body = await request.json();
        const { month, summaryText } = body;

        if (!month || !summaryText) {
            return NextResponse.json({ error: "Month (YYYY-MM) and summaryText are required." }, { status: 400 });
        }

        let coordinatorDocId = null;
        const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
        if (coordinatorDoc) {
            coordinatorDocId = coordinatorDoc._id;
        } else {
            return NextResponse.json({ error: "Coordinator profile not found." }, { status: 403 });
        }

        // Check if report already exists for this user and month
        const existing = await MonthlyReport.findOne({ coordinator: coordinatorDocId, month });
        if (existing) {
            return NextResponse.json({ error: "You already created a report for this month." }, { status: 400 });
        }

        const startDate = startOfMonth(parseISO(`${month}-01`));
        const endDate = endOfMonth(parseISO(`${month}-01`));

        let weeklyReportsForMonth = await WeeklyReport.find({
            weekEnding: { $gte: startDate, $lte: endDate },
            status: "submitted"
        }).populate("mentor", "state coordinator");

        if (session.user.role === UserRole.COORDINATOR) {
            weeklyReportsForMonth = weeklyReportsForMonth.filter(
                (wr) => (wr.mentor as any)?.coordinator?.toString() === coordinatorDocId.toString()
            );
        } else if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id });
            if (mentorDoc) {
                weeklyReportsForMonth = weeklyReportsForMonth.filter(
                    (wr) => wr.mentor._id.toString() === mentorDoc._id.toString()
                );
            }
        }

        const validWeeklyReports = weeklyReportsForMonth;

        const reportIds = validWeeklyReports.map((wr) => wr._id);

        const stateToSave = coordinatorDoc.states[0] || "Not Specified";

        const monthlyReport = await MonthlyReport.create({
            coordinator: coordinatorDocId,
            state: stateToSave,
            month,
            summaryText,
            weeklyReports: reportIds,
            status: "submitted"
        });

        return NextResponse.json(monthlyReport, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
