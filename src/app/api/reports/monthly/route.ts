import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MonthlyReport } from "@/models/MonthlyReport";
import { WeeklyReport } from "@/models/WeeklyReport";
import { Coordinator } from "@/models/Coordinator";
import { Mentor } from "@/models/Mentor";
import { DeskOfficer } from "@/models/DeskOfficer";
import { UserRole, normalizeLocation, resolveMentorStates } from "@/lib/constants";
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
        const mentorIdParam = searchParams.get("mentorId");

        const filter: Record<string, any> = {};

        // When filtering by a specific mentor, restrict to that mentor's reports.
        // Admin: any mentor. Coordinator: only their own mentors. Others: forbidden.
        if (mentorIdParam) {
            // mentorIdParam may be Mentor._id or the user's authId
            const targetMentor = await Mentor.findOne({ $or: [{ _id: mentorIdParam }, { authId: mentorIdParam }] }).lean();
            if (!targetMentor) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            if (session.user.role === UserRole.ADMIN) {
                filter.type = "mentor";
                filter.mentor = targetMentor._id;
            } else if (session.user.role === UserRole.COORDINATOR) {
                const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
                if (!coordinatorDoc || String(targetMentor.coordinator) !== String(coordinatorDoc._id)) {
                    return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
                }
                filter.type = "mentor";
                filter.mentor = targetMentor._id;
            } else {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        } else if (session.user.role === UserRole.COORDINATOR) {
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
                // Mentors can only see their own mentor reports
                filter.type = "mentor";
                filter.mentor = mentorDoc._id;
            }
        }

        if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
            const deskOfficerDoc = await DeskOfficer.findOne({ authId: session.user.id });
            const officerStates = (deskOfficerDoc?.states ?? [])
                .map((s: string) => normalizeLocation(s))
                .filter(Boolean);
            if (!officerStates.length) {
                return NextResponse.json({
                    data: [],
                    pagination: { page, limit, total: 0, totalPages: 0 },
                });
            }
            // Scope by the mentors/coordinators who actually work in these states.
            // The denormalised `state` field only ever stored states[0], so a
            // mentor covering LAGOS + OYO was invisible to the OYO desk officer.
            const [mentorIds, coordinatorIds] = await Promise.all([
                Mentor.find({ states: { $in: officerStates } }).distinct("_id"),
                Coordinator.find({ states: { $in: officerStates } }).distinct("_id"),
            ]);
            filter.$or = [
                { type: "mentor", mentor: { $in: mentorIds } },
                { type: "zonal", coordinator: { $in: coordinatorIds } },
            ];
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

        const normalizedData = data.map((report: any) => {
            const normalized: any = { ...report };
            if (report.coordinator?.authId) {
                const states: string[] = report.coordinator.states ?? [];
                normalized.coordinator = {
                    _id: report.coordinator._id,
                    name: report.coordinator.authId.name,
                    email: report.coordinator.authId.email,
                    // Show every state, not just the first — coordinators can span states.
                    state: states.join(", "),
                    states,
                };
            }
            if (report.mentor?.authId) {
                const states = resolveMentorStates(report.mentor);
                normalized.mentor = {
                    _id: report.mentor._id,
                    name: report.mentor.authId.name,
                    email: report.mentor.authId.email,
                    state: states.join(", "),
                    states,
                };
            }
            return normalized;
        });

        return NextResponse.json({
            data: normalizedData,
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
        const { month, summaryText, zonalAuditData } = body;

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

            const mentorStates = resolveMentorStates(mentorDoc);

            const monthlyReport = await MonthlyReport.create({
                type: "mentor",
                mentor: mentorDoc._id,
                state: mentorStates[0] || "Not Specified",
                states: mentorStates,
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

        const coordinatorStates = (coordinatorDoc.states ?? [])
            .map((s: string) => normalizeLocation(s))
            .filter(Boolean);

        const monthlyReport = await MonthlyReport.create({
            type: "zonal",
            coordinator: coordinatorDoc._id,
            state: coordinatorStates[0] || "Not Specified",
            states: coordinatorStates,
            month,
            summaryText,
            zonalAuditData: zonalAuditData || null,
            weeklyReports: weeklyReports.map((wr) => wr._id),
            status: "submitted",
        });

        return NextResponse.json(monthlyReport, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
