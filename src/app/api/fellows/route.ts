import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { DeskOfficer } from "@/models/DeskOfficer";
import { Coordinator } from "@/models/Coordinator";
import { UserRole } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== UserRole.MENTOR && session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.ME_OFFICER && session.user.role !== UserRole.ZONAL_DESK_OFFICER && session.user.role !== UserRole.TEAM_RESEARCH_LEAD && session.user.role !== UserRole.COORDINATOR) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await connectDB();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        const search = searchParams.get("search") || "";
        const filter: Record<string, unknown> = {};

        // Mentors only see their own fellows; admins, ME officers and Team Research Leads can see all; desk officers see zone-scoped
        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            filter.mentor = mentorDoc._id;
        } else if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
            const deskOfficerDoc = await DeskOfficer.findOne({ authId: session.user.id }).lean();
            if (deskOfficerDoc && deskOfficerDoc.states && deskOfficerDoc.states.length > 0) {
                const mentorIds = await Mentor.find({ states: { $in: deskOfficerDoc.states } }).distinct("_id");
                filter.mentor = { $in: mentorIds };
            } else {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
        } else if (session.user.role === UserRole.COORDINATOR) {
            const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (coordinatorDoc) {
                const mentorIds = await Mentor.find({ coordinator: coordinatorDoc._id }).distinct("_id");
                filter.mentor = { $in: mentorIds };
            } else {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
        }

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ name: regex }, { lga: regex }];
        }

        const [data, total] = await Promise.all([
            Fellow.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Fellow.countDocuments(filter),
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
        if (!session?.user || session.user.role !== UserRole.MENTOR) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const body = await request.json();

        const mentorDoc = await Mentor.findOne({ authId: session.user.id });
        if (!mentorDoc) return NextResponse.json({ error: "Mentor profile not found" }, { status: 403 });

        const fellow = await Fellow.create({
            ...body,
            mentor: mentorDoc._id,
        });

        void logActivity({ session, action: "CREATE_FELLOW", targetType: "Fellow", targetId: String(fellow._id), targetName: fellow.name });
        return NextResponse.json(fellow, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
