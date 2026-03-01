/* ──────────────────────────────────────────
   API: /api/mentors/bulk — Bulk actions for mentors
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Mentor, Coordinator } from "@/models";
import { UserRole, APP_NAME } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";

interface BulkMentorInput {
    name: string;
    email: string;
    phone?: string;
    state?: string;
    lgas?: string;
}

interface BulkMentorBody {
    mentors: BulkMentorInput[];
}

// Generate a random 8-character password
function generatePassword() {
    return Math.random().toString(36).slice(-8);
}

export async function POST(request: NextRequest) {
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

    let coordinatorId = null;
    if (session?.user.role === UserRole.COORDINATOR) {
        const coordinatorDoc = await Coordinator.findOne({ authId: session.user.id });
        if (coordinatorDoc) {
            coordinatorId = coordinatorDoc._id;
        } else {
            return jsonError("Coordinator profile not found for this user.");
        }
    } else {
        // If Admin uploads, we might need a fallback or prevent it. For now, require coordinator.
        return jsonError("Only Coordinators can bulk upload Mentors currently, as they must be assigned to the uploading Coordinator.");
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
                state: mentorInput.state?.trim().toUpperCase() || "",
                lgas: lgasArray,
            });

            // Send greeting email with credentials
            const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #16a34a;">Welcome to ${APP_NAME}</h2>
          <p>Hello ${mentorInput.name.trim()},</p>
          <p>An account has been created for you on the ${APP_NAME} portal.</p>
          <p>Below are your login credentials:</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Password:</strong> <span style="font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 4px;">${rawPassword}</span></li>
          </ul>
          <p>Please log in and update your profile.</p>
          <br/>
          <p>Best regards,<br/>NHF Admin Team</p>
        </div>
      `;

            await sendMail({
                to: email,
                subject: `Welcome to ${APP_NAME} - Account Created`,
                html: emailHtml,
            });

            results.successful++;
        } catch (err) {
            results.failed++;
            results.errors.push((err as Error).message);
        }
    }

    return jsonCreated(results);
}
