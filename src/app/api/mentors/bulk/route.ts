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
import { sendMail } from "@/lib/mailer";
import { newMentorEmailTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";

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
        };

        for (const mentorInput of body.mentors) {
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

                const lgasArray = mentorInput.lgas
                    ? mentorInput.lgas.split(",").map((lga) => lga.trim().toUpperCase()).filter(Boolean)
                    : [];

                const statesArray = mentorInput.states
                    ? mentorInput.states.split(",").map((st) => st.trim().toUpperCase()).filter(Boolean)
                    : [];

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
                    states: statesArray,
                    lgas: lgasArray,
                });

                const emailContent = newMentorEmailTemplate(
                    mentorInput.name.trim(),
                    email,
                    rawPassword,
                    env.NEXTAUTH_URL()
                );

                await sendMail({
                    to: email,
                    subject: emailContent.subject,
                    text: emailContent.text,
                    html: emailContent.html,
                });

                results.successful++;
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
