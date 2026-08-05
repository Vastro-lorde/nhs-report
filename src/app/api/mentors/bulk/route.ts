/* ──────────────────────────────────────────
   API: /api/mentors/bulk — Bulk actions for mentors
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Mentor, Coordinator } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody } from "@/lib/api-helpers";
import { sendMailWithRetry, delay } from "@/lib/mailer";
import { newMentorEmailTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { normalizeMentorLocations } from "@/services/mentor-coverage.service";

interface BulkMentorInput {
    name: string;
    email: string;
    phone?: string;
    states?: string;
    lgas?: string;
}

interface BulkMentorBody {
    mentors: BulkMentorInput[];
    coordinatorId?: string;
}

// Generate a random 8-character password
function generatePassword() {
    return Math.random().toString(36).slice(-8);
}

export async function POST(request: NextRequest) {
    try {
        const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
        if (error) return error;

        const body = await parseBody<BulkMentorBody>(request);
        if (!body || !Array.isArray(body.mentors) || body.mentors.length === 0) {
            return jsonError("Invalid payload. Expected 'mentors' array.");
        }

        // Maximum 500 rows based on requirements
        if (body.mentors.length > 500) {
            return jsonError("Exceeded maximum of 500 records per upload.");
        }

        await connectDB();

        let coordinatorId = body.coordinatorId || null;
        if (session?.user.role === UserRole.COORDINATOR) {
            const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
            if (coordinatorDoc) {
                coordinatorId = coordinatorDoc._id.toString(); // enforce their own ID
            } else {
                return jsonError("Coordinator profile not found for this user.");
            }
        } else if (session?.user.role === UserRole.ADMIN) {
            if (!coordinatorId) {
                return jsonError("Admins must provide a coordinatorId to assign these mentors to.");
            }
            // Optional: verify the coordinator exists
            const coordinatorExists = await Coordinator.findById(coordinatorId);
            if (!coordinatorExists) {
                return jsonError("The selected coordinator does not exist.");
            }
        } else {
            return jsonError("Unauthorized to bulk upload mentors.");
        }

        const results = {
            successful: 0,
            failed: 0,
            errors: [] as string[],
            // LGA names that could not be matched to a state — saved anyway.
            warnings: [] as string[],
        };

        const BATCH_SIZE = 20;
        const INTER_EMAIL_DELAY_MS = 1000;  // 1 s between each send
        const INTER_BATCH_DELAY_MS = 5000; // 5 s between batches

        for (let idx = 0; idx < body.mentors.length; idx++) {
            const mentorInput = body.mentors[idx];
            try {
                const email = mentorInput.email?.toLowerCase().trim();
                if (!email) {
                    throw new Error("Email is missing");
                }
                if (!mentorInput.name) {
                    throw new Error(`Name is missing for email ${email}`);
                }

                const existing = await User.findOne({ email });
                if (existing) {
                    throw new Error(`User with email ${email} already exists`);
                }

                const rawPassword = generatePassword();
                const hashedPassword = await bcrypt.hash(rawPassword, 12);

                // Both columns are comma-separated lists — a mentor may cover
                // several states, and LGAs in each of them.
                const locations = normalizeMentorLocations(
                    mentorInput.states ? mentorInput.states.split(",") : [],
                    mentorInput.lgas ? mentorInput.lgas.split(",") : []
                );
                if (locations.errors.length) {
                    throw new Error(`${email}: ${locations.errors.join(" ")}`);
                }
                if (locations.warnings.length) {
                    results.warnings.push(`${email}: ${locations.warnings.join(" ")}`);
                }

                const newUser = await User.create({
                    name: mentorInput.name.trim(),
                    email: email,
                    password: hashedPassword,
                    phone: mentorInput.phone?.trim() || "",
                    role: UserRole.MENTOR,
                    active: true,
                });

                await Mentor.create({
                    authId: newUser._id,
                    coordinator: coordinatorId,
                    states: locations.states,
                    lgas: locations.lgas,
                });

                const emailContent = newMentorEmailTemplate(
                    mentorInput.name.trim(),
                    email,
                    rawPassword,
                    env.NEXTAUTH_URL()
                );

                await sendMailWithRetry({
                    to: email,
                    subject: emailContent.subject,
                    text: emailContent.text,
                    html: emailContent.html,
                });

                results.successful++;

                // Rate-limit sends: 1 s between emails, 5 s between every 20th
                const isLastInBatch = (idx + 1) % BATCH_SIZE === 0;
                const isLast = idx === body.mentors.length - 1;
                if (!isLast) {
                    await delay(isLastInBatch ? INTER_BATCH_DELAY_MS : INTER_EMAIL_DELAY_MS);
                }
            } catch (err) {
                results.failed++;
                results.errors.push((err as Error).message);
            }
        }

        return jsonCreated(results);
    } catch (globalErr: unknown) {
        console.error("Mentor Bulk Upload 500 Error:", globalErr);
        const message = globalErr instanceof Error ? globalErr.message : String(globalErr);
        return jsonError(`Internal Server Error: ${message}`, 500);
    }
}

// DELETE /api/mentors/bulk — Bulk delete mentors
export async function DELETE(request: NextRequest) {
    try {
        const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
        if (error) return error;

        const body = await parseBody<{ ids: string[] }>(request);
        if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
            return jsonError("Invalid payload. Expected an array of 'ids'.");
        }

        await connectDB();

        let idsToDelete = body.ids;

        if (session?.user.role === UserRole.COORDINATOR) {
            const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (!coordinatorDoc) return jsonError("Coordinator profile not found for this user.");

            const mentorDocs = await Mentor.find({
                authId: { $in: body.ids },
                coordinator: coordinatorDoc._id,
            }).select("authId").lean();

            idsToDelete = mentorDocs.map((m) => m.authId.toString());
        }

        if (!idsToDelete.length) {
            return jsonOk({ success: true, deletedCount: 0 });
        }

        const deleteResult = await User.deleteMany({
            _id: { $in: idsToDelete },
            role: UserRole.MENTOR
        });

        await Mentor.deleteMany({
            authId: { $in: idsToDelete }
        });

        return jsonOk({
            success: true,
            deletedCount: deleteResult.deletedCount
        });
    } catch (globalErr: unknown) {
        console.error("Mentor Bulk Delete Error:", globalErr);
        const message = globalErr instanceof Error ? globalErr.message : String(globalErr);
        return jsonError(`Internal Server Error: ${message}`, 500);
    }
}
