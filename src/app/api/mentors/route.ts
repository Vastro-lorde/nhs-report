/* ──────────────────────────────────────────
   API: /api/mentors — CRUD for mentors
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";

// GET /api/mentors — list mentors (admin/coordinator)
export async function GET(request: NextRequest) {
  const { error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
  if (error) return error;

  await connectDB();

  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);

  const filter: Record<string, unknown> = { role: UserRole.MENTOR };
  const state = url.searchParams.get("state");
  const active = url.searchParams.get("active");
  const search = url.searchParams.get("search");

  if (state) filter.state = state;
  if (active !== null) filter.active = active === "true";
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [mentors, total] = await Promise.all([
    User.find(filter).select("-password").skip(skip).limit(limit).sort({ name: 1 }).lean(),
    User.countDocuments(filter),
  ]);

  return jsonOk({
    data: mentors,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/mentors — create a mentor (admin only)
interface CreateMentorBody {
  name: string;
  email: string;
  password: string;
  phone?: string;
  state?: string;
  lgas?: string[];
}

export async function POST(request: NextRequest) {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const body = await parseBody<CreateMentorBody>(request);
  if (!body || !body.name || !body.email || !body.password) {
    return jsonError("Name, email, and password are required");
  }

  await connectDB();

  const existing = await User.findOne({ email: body.email.toLowerCase().trim() });
  if (existing) return jsonError("A user with this email already exists", 409);

  const hashedPassword = await bcrypt.hash(body.password, 12);

  const mentor = await User.create({
    name: body.name.trim(),
    email: body.email.toLowerCase().trim(),
    password: hashedPassword,
    phone: body.phone?.trim(),
    role: UserRole.MENTOR,
    state: body.state,
    lgas: body.lgas ?? [],
    active: true,
  });

  const { password: _, ...mentorData } = mentor.toObject();
  void _;
  return jsonCreated(mentorData);
}
