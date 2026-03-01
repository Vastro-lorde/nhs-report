/* ──────────────────────────────────────────
   API: /api/document-types
   GET: List all document types (Admin, Coordinator, Mentor)
   POST: Create a new document type (Admin only)
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { DocumentType } from "@/models/DocumentType";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
    // Allow ADMIN, COORDINATOR, and MENTOR to get document types
    const { error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR);
    if (error) return error;

    await connectDB();

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const [documentTypes, total] = await Promise.all([
        DocumentType.find().skip(skip).limit(limit).sort({ title: 1 }).lean(),
        DocumentType.countDocuments(),
    ]);

    return jsonOk({
        data: documentTypes,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
}

interface CreateDocumentTypeBody {
    title: string;
}

export async function POST(request: NextRequest) {
    // Only Admin can create document types
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const body = await parseBody<CreateDocumentTypeBody>(request);
    if (!body || !body.title) {
        return jsonError("Title is required");
    }

    await connectDB();

    const existing = await DocumentType.findOne({ title: { $regex: new RegExp(`^${body.title.trim()}$`, 'i') } });
    if (existing) return jsonError("A document type with this title already exists", 409);

    const documentType = await DocumentType.create({
        title: body.title.trim(),
    });

    return jsonCreated(documentType);
}
