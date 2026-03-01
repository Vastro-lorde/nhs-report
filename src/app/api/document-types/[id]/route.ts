/* ──────────────────────────────────────────
   API: /api/document-types/[id]
   PUT: Update a document type (Admin only)
   DELETE: Delete a document type (Admin only)
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { DocumentType } from "@/models/DocumentType";
import { FellowDocument } from "@/models/FellowDocument";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";

interface RouteParams {
    params: Promise<{ id: string }>;
}

interface UpdateDocumentTypeBody {
    title: string;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await parseBody<UpdateDocumentTypeBody>(request);
    if (!body || !body.title) {
        return jsonError("Title is required");
    }

    await connectDB();

    const existing = await DocumentType.findOne({
        title: { $regex: new RegExp(`^${body.title.trim()}$`, 'i') },
        _id: { $ne: id }
    });
    if (existing) return jsonError("Another document type with this title already exists", 409);

    const documentType = await DocumentType.findByIdAndUpdate(
        id,
        { title: body.title.trim() },
        { new: true, runValidators: true }
    ).lean();

    if (!documentType) return jsonError("Document type not found", 404);

    return jsonOk(documentType);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const resolvedParams = await params;
    const { id } = resolvedParams;

    await connectDB();

    // Check if any fellow document is using this document type
    const inUse = await FellowDocument.exists({ documentType: id });
    if (inUse) {
        return jsonError("Cannot delete: Document type is currently assigned to one or more fellow documents", 400);
    }

    const documentType = await DocumentType.findByIdAndDelete(id).lean();
    if (!documentType) return jsonError("Document type not found", 404);

    return jsonOk({ success: true, message: "Document type deleted successfully" });
}
