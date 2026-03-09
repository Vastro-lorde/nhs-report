import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { Mentor } from "@/models/Mentor";

type BulkCreateFellowInput = {
    name?: string;
    gender?: string;
    lga?: string;
    profession?: string;
    // extra fields may exist in CSV payload; we ignore them server-side
    state?: string;
    phone?: string;
    mentorId?: string;
};

// POST /api/fellows/bulk — Bulk create fellows (mentors only, scoped to current mentor)
export async function POST(request: NextRequest) {
    try {
        const { session, error } = await requireRole(UserRole.MENTOR);
        if (error) return error;

        const body = await parseBody<{ fellows: BulkCreateFellowInput[] }>(request);
        if (!body || !Array.isArray(body.fellows) || body.fellows.length === 0) {
            return jsonError("Invalid payload. Expected { fellows: [...] }.");
        }

        if (body.fellows.length > 500) {
            return jsonError("Maximum 500 records allowed.");
        }

        await connectDB();

        const mentorDoc = await Mentor.findOne({ authId: session!.user.id }).lean();
        if (!mentorDoc) return jsonError("Mentor profile not found", 403);

        let successful = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < body.fellows.length; i++) {
            const rowNumber = i + 1;
            const row = body.fellows[i] ?? {};

            const name = (row.name ?? "").trim();
            const gender = (row.gender ?? "").trim();
            const lga = (row.lga ?? "").trim();
            const profession = (row.profession ?? "").trim();

            if (!name || !gender || !lga) {
                failed++;
                errors.push(`Row ${rowNumber}: missing required fields (name, gender, lga).`);
                continue;
            }

            try {
                await Fellow.create({
                    mentor: mentorDoc._id,
                    name,
                    gender,
                    lga,
                    ...(profession ? { profession } : {}),
                });
                successful++;
            } catch (e: any) {
                failed++;
                errors.push(`Row ${rowNumber}: ${e?.message ?? "Failed to create fellow"}`);
            }
        }

        return jsonOk({ successful, failed, errors });
    } catch (globalErr: any) {
        console.error("Fellow Bulk Create Error:", globalErr);
        return jsonError(`Internal Server Error: ${globalErr.message}`, 500);
    }
}

// DELETE /api/fellows/bulk — Bulk delete fellows
export async function DELETE(request: NextRequest) {
    try {
        const { session, error } = await requireRole(UserRole.MENTOR, UserRole.ADMIN);
        if (error) return error;

        const body = await parseBody<{ ids: string[] }>(request);
        if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
            return jsonError("Invalid payload. Expected an array of 'ids'.");
        }

        await connectDB();

        const deleteFilter: Record<string, unknown> = {
            _id: { $in: body.ids },
        };

        if (session!.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session!.user.id }).lean();
            if (!mentorDoc) return jsonError("Mentor profile not found", 403);
            deleteFilter.mentor = mentorDoc._id;
        }

        const deleteResult = await Fellow.deleteMany(deleteFilter);

        return jsonOk({
            success: true,
            deletedCount: deleteResult.deletedCount
        });
    } catch (globalErr: any) {
        console.error("Fellow Bulk Delete Error:", globalErr);
        return jsonError(`Internal Server Error: ${globalErr.message}`, 500);
    }
}
