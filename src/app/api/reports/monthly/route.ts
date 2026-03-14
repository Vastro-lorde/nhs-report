import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MonthlyReport } from "@/models/MonthlyReport";
import { WeeklyReport } from "@/models/WeeklyReport";
import { Coordinator } from "@/models/Coordinator";
import { Mentor } from "@/models/Mentor";
import { DeskOfficer } from "@/models/DeskOfficer";
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

        if (session.user.role === UserRole.COORDINATOR) {
            const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
            if (coordinatorDoc) {
                // Coordinators see their own zonal reports + mentor reports from their mentors
                const mentorIds = await Mentor.find({ coordinator: coordinatorDoc._id }).distinct("_id");
                filter.$or = [
                    { type: "zonal", coordinator: coordinatorDoc._id },
                    { type: "mentor", mentor: { $in: mentorIds } },
                ];
            }
        }

        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id });
            if (mentorDoc) {
                // Mentors see their own mentor reports + their coordinator's zonal reports
                filter.$or = [
                    { type: "mentor", mentor: mentorDoc._id },
                    { type: "zonal", coordinator: mentorDoc.coordinator },
                ];
            }
        }

        if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
            const deskOfficerDoc = await DeskOfficer.findOne({ authId: session.user.id });
            if (deskOfficerDoc && deskOfficerDoc.states && deskOfficerDoc.states.length > 0) {
                filter.state = { $in: deskOfficerDoc.states };
            } else {
                return NextResponse.json({
                    data: [],
                    pagination: { page, limit, total: 0, totalPages: 0 },
                });
            }
        }

        // Admin, ME Officer, Team Research Lead see all — no filter needed

        const [data, total] = await Promise.all([
            MonthlyReport.find(filter)
                .populate({
                    path: "coordinator",
                    populate: {
                        path: "authId",
                        select: "name email"
                    }
                })
                .populate({
                    path: "mentor",
                    populate: {
                        path: "authId",
                        select: "name email"
                    }
                })
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

        const startDate = startOfMonth(parseISO(`${month}-01`));
        const endDate = endOfMonth(parseISO(`${month}-01`));

        // ── Mentor monthly report ──────────────────────────────
        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id });
            if (!mentorDoc) {
                return NextResponse.json({ error: "Mentor profile not found." }, { status: 403 });
            }

            const existing = await MonthlyReport.findOne({ type: "mentor", mentor: mentorDoc._id, month });
            if (existing) {
                return NextResponse.json({ error: "You already created a monthly report for this month." }, { status: 400 });
            }

            const weeklyReports = await WeeklyReport.find({
                mentor: mentorDoc._id,
                weekEnding: { $gte: startDate, $lte: endDate },
                status: "submitted",
            });

            const mentorState = mentorDoc.states?.[0] || "Not Specified";

            const monthlyReport = await MonthlyReport.create({
                type: "mentor",
                mentor: mentorDoc._id,
                state: mentorState,
                month,
                summaryText,
                weeklyReports: weeklyReports.map((wr) => wr._id),
                status: "submitted",
            });

            return NextResponse.json(monthlyReport, { status: 201 });
        }

        // ── Coordinator zonal monthly report ───────────────────
        const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
        if (!coordinatorDoc) {
            return NextResponse.json({ error: "Coordinator profile not found." }, { status: 403 });
        }

        const existing = await MonthlyReport.findOne({ type: "zonal", coordinator: coordinatorDoc._id, month });
        if (existing) {
            return NextResponse.json({ error: "You already created a zonal report for this month." }, { status: 400 });
        }

        const mentorIds = await Mentor.find({ coordinator: coordinatorDoc._id }).distinct("_id");

        const weeklyReports = await WeeklyReport.find({
            mentor: { $in: mentorIds },
            weekEnding: { $gte: startDate, $lte: endDate },
            status: "submitted",
        });

        const stateToSave = coordinatorDoc.states[0] || "Not Specified";

        const monthlyReport = await MonthlyReport.create({
            type: "zonal",
            coordinator: coordinatorDoc._id,
            state: stateToSave,
            month,
            summaryText,
            weeklyReports: weeklyReports.map((wr) => wr._id),
            status: "submitted",
        });

        return NextResponse.json(monthlyReport, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
