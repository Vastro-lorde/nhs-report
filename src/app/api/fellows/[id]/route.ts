import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models/Fellow";
import { UserRole } from "@/lib/constants";

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

        await connectDB();
        const fellow = await Fellow.findById(id);

        if (!fellow) {
            return NextResponse.json({ error: "Fellow not found" }, { status: 404 });
        }

        // Only the assigned mentor (or Admin) can update
        const isMentor = session.user.role === UserRole.MENTOR;
        if (isMentor && fellow.mentor.toString() !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await request.json();

        if (body.name !== undefined) fellow.name = body.name;
        if (body.gender !== undefined) fellow.gender = body.gender;
        if (body.lga !== undefined) fellow.lga = body.lga;

        await fellow.save();

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

        await connectDB();
        const fellow = await Fellow.findById(id);

        if (!fellow) {
            return NextResponse.json({ error: "Fellow not found" }, { status: 404 });
        }

        const isMentor = session.user.role === UserRole.MENTOR;
        if (isMentor && fellow.mentor.toString() !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await Fellow.deleteOne({ _id: fellow._id });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
