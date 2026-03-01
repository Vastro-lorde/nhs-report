import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { UserRole } from "@/lib/constants";

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

        // Determine query context
        const isMentor = session.user.role === UserRole.MENTOR;
        const filter: Record<string, any> = {};

        if (isMentor) {
            // Mentors only see their own fellows
            const mentorDoc = await Mentor.findOne({ authId: session.user.id });
            if (!mentorDoc) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            filter.mentor = mentorDoc._id;
        } else {
            // Coordinators / Admins could theoretically see all, or filtered
            // If we want state-based filtering, we'd add it here based on session.user.state
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

        return NextResponse.json(fellow, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
