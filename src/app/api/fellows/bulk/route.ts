import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Fellow } from "@/models";
import {
    UserRole,
    getStatesForLGA,
    isKnownState,
    normalizeLocation,
    resolveMentorStates,
} from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { Mentor } from "@/models/Mentor";
import { ensureMentorCoversLga, resolveFellowLga } from "@/services/mentor-coverage.service";

type BulkCreateFellowInput = {
    name?: string;
    gender?: string;
    lga?: string;
    qualification?: string;
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
        const warnings: string[] = [];
        // Grows as rows introduce LGAs from states the profile did not list, so
        // later rows in the same upload resolve against the widened coverage.
        let mentorStates = resolveMentorStates(mentorDoc);

        for (let i = 0; i < body.fellows.length; i++) {
            const rowNumber = i + 1;
            const row = body.fellows[i] ?? {};

            const name = (row.name ?? "").trim();
            const gender = (row.gender ?? "").trim();
            const lga = (row.lga ?? "").trim();
            const qualification = (row.qualification ?? "").trim();
            // Optional CSV column — the only reliable way to tell apart LGA names
            // that exist in two states (SURULERE: Lagos & Oyo, OBI: Benue & Nasarawa …).
            const rowState = normalizeLocation(row.state);

            if (!name || !gender || !lga) {
                failed++;
                errors.push(`Row ${rowNumber}: missing required fields (name, gender, lga).`);
                continue;
            }

            const hint = rowState ? [rowState, ...mentorStates] : mentorStates;
            const resolved = resolveFellowLga(lga, hint);
            if ("error" in resolved) {
                failed++;
                errors.push(`Row ${rowNumber}: ${resolved.error}`);
                continue;
            }
            if (resolved.warning) {
                warnings.push(`Row ${rowNumber}: ${resolved.warning}`);
            } else if (rowState && isKnownState(rowState) && resolved.state !== rowState) {
                // The CSV's own State column contradicts the LGA — worth flagging,
                // but the LGA is the more reliable of the two.
                warnings.push(
                    `Row ${rowNumber}: "${lga}" belongs to ${getStatesForLGA(lga).join(" / ")}, not ${rowState} — recorded under ${resolved.state}.`
                );
            } else if (resolved.outsideMentorStates) {
                warnings.push(
                    `Row ${rowNumber}: ${resolved.lga} is in ${resolved.state}, which was not on your profile — it has been added to your assigned states.`
                );
            }

            try {
                await Fellow.create({
                    mentor: mentorDoc._id,
                    name,
                    gender,
                    lga: resolved.lga,
                    ...(qualification ? { qualification } : {}),
                });
                await ensureMentorCoversLga(mentorDoc._id, resolved.lga, mentorStates);
                if (resolved.state && !mentorStates.includes(resolved.state)) {
                    mentorStates = [...mentorStates, resolved.state];
                }
                successful++;
            } catch (e: any) {
                failed++;
                errors.push(`Row ${rowNumber}: ${e?.message ?? "Failed to create fellow"}`);
            }
        }

        return jsonOk({ successful, failed, errors, warnings });
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
