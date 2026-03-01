/* ──────────────────────────────────────────
   API: /api/fellows/[id]/documents
   GET: List documents for a fellow
   POST: Upload documents for a fellow
   ────────────────────────────────────────── */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models/Fellow";
import { FellowDocument } from "@/models/FellowDocument";
import { requireAuth } from "@/lib/auth-guard";
import { UserRole } from "@/lib/constants";
import { jsonOk, jsonCreated, parseBody } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    // Verify access to this fellow
    const fellow = await Fellow.findById(id).lean();
    if (!fellow) return NextResponse.json({ error: "Fellow not found" }, { status: 404 });

    if (session!.user.role === UserRole.MENTOR && fellow.mentor.toString() !== session!.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await FellowDocument.find({ fellow: id })
        .populate("documentType", "title")
        .sort({ createdAt: -1 })
        .lean();

    return jsonOk(documents);
}

export async function POST(request: NextRequest, { params }: Params) {
    const { session, error } = await requireAuth();
    if (error) return error;

    if (session!.user.role !== UserRole.MENTOR && session!.user.role !== UserRole.ADMIN && session!.user.role !== UserRole.COORDINATOR) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    // Verify access to this fellow
    const fellow = await Fellow.findById(id).lean();
    if (!fellow) return NextResponse.json({ error: "Fellow not found" }, { status: 404 });

    if (session!.user.role === UserRole.MENTOR && fellow.mentor.toString() !== session!.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await parseBody<{ documents: { documentTypeId: string; url: string }[] }>(request);
    if (!body || !Array.isArray(body.documents) || body.documents.length === 0) {
        return NextResponse.json({ error: "Invalid payload. Expected 'documents' array." }, { status: 400 });
    }

    const newDocs = body.documents.map((doc) => ({
        fellow: id,
        documentType: doc.documentTypeId,
        url: doc.url,
    }));

    const createdDocs = await FellowDocument.insertMany(newDocs);

    return jsonCreated(createdDocs);
}
