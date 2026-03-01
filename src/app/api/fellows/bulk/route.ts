import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Fellow, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody } from "@/lib/api-helpers";

interface BulkFellowInput {
    name: string;
    gender: string;
    lga: string;
    mentorId: string; // The UI will provide this from the user's manual or auto assignment
}

interface BulkFellowBody {
    fellows: BulkFellowInput[];
}

export async function POST(request: NextRequest) {
    const { session, error } = await requireRole(UserRole.COORDINATOR);
    if (error) return error;

    const body = await parseBody<BulkFellowBody>(request);
    if (!body || !Array.isArray(body.fellows) || body.fellows.length === 0) {
        return jsonError("Invalid payload. Expected 'fellows' array.");
    }

    if (body.fellows.length > 500) {
        return jsonError("Exceeded maximum of 500 records per upload.");
    }

    await connectDB();

    const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (let i = 0; i < body.fellows.length; i++) {
        const fellowInput = body.fellows[i];
        try {
            if (!fellowInput.name || !fellowInput.gender || !fellowInput.lga || !fellowInput.mentorId) {
                throw new Error(`Row ${i + 1}: Missing required fields (name, gender, lga, mentorId).`);
            }

            // Verify mentor exists (optional but good for data integrity)
            const mentorExists = await Mentor.findById(fellowInput.mentorId);
            if (!mentorExists) {
                throw new Error(`Row ${i + 1}: Valid Mentor not found for ID ${fellowInput.mentorId}`);
            }

            await Fellow.create({
                mentor: fellowInput.mentorId,
                name: fellowInput.name.trim(),
                gender: fellowInput.gender.trim(),
                lga: fellowInput.lga.trim().toUpperCase()
            });

            results.successful++;
        } catch (err) {
            results.failed++;
            results.errors.push((err as Error).message);
        }
    }

    return jsonCreated(results);
}
