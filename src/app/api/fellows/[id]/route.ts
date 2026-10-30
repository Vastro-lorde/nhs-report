import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { UserRole, resolveMentorStates } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";
import { ensureMentorCoversLga, resolveFellowLga } from "@/services/mentor-coverage.service";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== UserRole.MENTOR && session.user.role !== UserRole.ADMIN) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await connectDB();

        const fellow = await Fellow.findById(id);

        if (!fellow) {
            return NextResponse.json({ error: "Fellow not found" }, { status: 404 });
        }

        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc) {
                return NextResponse.json({ error: "Mentor profile not found" }, { status: 403 });
            }

            // Only the assigned mentor can update
            if (fellow.mentor.toString() !== mentorDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const body = await request.json();

        if (body.name !== undefined) fellow.name = body.name;
        if (body.gender !== undefined) fellow.gender = body.gender;
        if (body.qualification !== undefined) fellow.qualification = body.qualification;

        if (body.lga !== undefined) {
            // Resolve against the fellow's own mentor (which is not necessarily
            // the caller — admins can edit any fellow).
            const owningMentor = await Mentor.findById(fellow.mentor).lean();
            const mentorStates = resolveMentorStates(owningMentor);
            const resolved = resolveFellowLga(body.lga, mentorStates);
            if ("error" in resolved) {
                return NextResponse.json({ error: resolved.error }, { status: 400 });
            }
            fellow.lga = resolved.lga;
            // Moving a fellow across a state border widens the mentor's coverage.
            await ensureMentorCoversLga(fellow.mentor, resolved.lga, mentorStates);
        }

        await fellow.save();

        void logActivity({ session, action: "UPDATE_FELLOW", targetType: "Fellow", targetId: id, targetName: fellow.name });
        return NextResponse.json(fellow);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role !== UserRole.MENTOR && session.user.role !== UserRole.ADMIN) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await connectDB();

        const fellow = await Fellow.findById(id);

        if (!fellow) {
            return NextResponse.json({ error: "Fellow not found" }, { status: 404 });
        }

        if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc) {
                return NextResponse.json({ error: "Mentor profile not found" }, { status: 403 });
            }

            if (fellow.mentor.toString() !== mentorDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        await Fellow.deleteOne({ _id: fellow._id });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
