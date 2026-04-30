import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { ReportHistory } from "@/models/ReportHistory";
import { UserRole, ReportHistoryReportType, ReportHistoryAction } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        const rawStateParam = searchParams.get("state");
        const stateParam = rawStateParam ? rawStateParam.toUpperCase().trim() : "";
        const qParam = (searchParams.get("q") || "").trim();
        const filter: Record<string, any> = {};

        if (qParam) {
            // Case-insensitive search against denormalised fellow name
            const escaped = qParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.fellowName = { $regex: escaped, $options: "i" };
        }

        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            filter.mentor = mentorDoc._id;
        } else if (session.user.role === UserRole.COORDINATOR) {
            const coordDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (!coordDoc) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            const mentorFilter: Record<string, any> = { coordinator: coordDoc._id };
            if (stateParam) mentorFilter.states = stateParam;
            const mentorIds = await Mentor.find(mentorFilter).distinct("_id");
            filter.mentor = { $in: mentorIds };
        } else if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
            const deskOfficerDoc = await DeskOfficer.findOne({ authId: session.user.id }).lean();
            if (!deskOfficerDoc || !deskOfficerDoc.states?.length) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            const officerStates = deskOfficerDoc.states.map((s: string) => String(s).toUpperCase());
            const allowedStates = stateParam
                ? officerStates.filter((s: string) => s === stateParam)
                : officerStates;
            const mentorIds = await Mentor.find({ states: { $in: allowedStates } }).distinct("_id");
            filter.mentor = { $in: mentorIds };
        } else if (stateParam) {
            // Admin, ME Officer, Team Research Lead – filter by state if provided
            const mentorIds = await Mentor.find({ states: stateParam }).distinct("_id");
            filter.mentor = { $in: mentorIds };
        }
        // Without stateParam, Admin/ME Officer/Team Research Lead see all

        const [data, total] = await Promise.all([
            MentorMonthlyReport.find(filter)
                .populate({ path: "mentor", populate: { path: "authId", select: "name email" } })
                .populate({ path: "fellow", select: "name lga qualification" })
                .sort({ month: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MentorMonthlyReport.countDocuments(filter),
        ]);

        return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== UserRole.MENTOR) {
            return NextResponse.json({ error: "Only mentors can submit fellow monthly reports." }, { status: 403 });
        }

        await connectDB();
        const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
        if (!mentorDoc) return NextResponse.json({ error: "Mentor profile not found." }, { status: 403 });

        const body = await request.json();

        const fellowDoc = await Fellow.findById(body.fellow).lean();
        if (!fellowDoc) return NextResponse.json({ error: "Fellow not found." }, { status: 400 });

        const report = await MentorMonthlyReport.create({
            ...body,
            mentor: mentorDoc._id,
            fellowName: fellowDoc.name,
            fellowLGA: fellowDoc.lga ?? "",
            fellowQualification: fellowDoc.qualification ?? "",
        });

        void logActivity({
            session,
            action: "CREATE_MENTOR_MONTHLY_REPORT",
            targetType: "MentorMonthlyReport",
            targetId: String(report._id),
            targetName: `${fellowDoc.name} – ${body.month}`,
        });

        void ReportHistory.create({
            reportId: report._id,
            reportType: ReportHistoryReportType.MENTOR_MONTHLY_REPORT,
            action: ReportHistoryAction.CREATED,
            snapshot: null,
            actorId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
        });

        return NextResponse.json(report, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json(
                { error: "A report for this fellow and month already exists." },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
