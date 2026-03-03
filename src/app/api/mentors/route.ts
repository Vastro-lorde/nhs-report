/* ──────────────────────────────────────────
   API: /api/mentors — CRUD for mentors
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Mentor, Coordinator } from "@/models";
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
  const search = url.searchParams.get("search");

  // Mentor-specific filters
  const mentorFilter: Record<string, unknown> = {};
  const state = url.searchParams.get("state");
  if (state) mentorFilter.state = state;

  const active = url.searchParams.get("active");
  if (active !== null) filter.active = active === "true";

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // 1. Find matching users first
  const users = await User.find(filter).select("-password").sort({ name: 1 }).lean();
  let userIds = users.map(u => u._id);

  // 2. Find matching mentor details linked to these users
  mentorFilter.authId = { $in: userIds };
  const mentorDetailsList = await Mentor.find(mentorFilter).lean();

  // Filter users by matching mentor docs (if specific mentor filters were applied)
  const matchedAuthIds = new Set(mentorDetailsList.map(md => md.authId.toString()));
  let finalUsers = users.filter(u => matchedAuthIds.has(u._id.toString()));

  const total = finalUsers.length;
  // Apply pagination
  finalUsers = finalUsers.slice(skip, skip + limit);

  // Combine user info with mentor info
  const mentors = finalUsers.map(u => {
    const md = mentorDetailsList.find(m => m.authId.toString() === u._id.toString());
    return {
      ...u,
      state: md?.state || "",
      lgas: md?.lgas || [],
      coordinator: md?.coordinator,
      mentorId: md?._id, // Outputting the mentor doc ID as well
    };
  });

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

  const user = await User.create({
    name: body.name.trim(),
    email: body.email.toLowerCase().trim(),
    password: hashedPassword,
    phone: body.phone?.trim(),
    role: UserRole.MENTOR,
    active: true,
  });

  // Automatically try to assign to admin or placeholder, usually admins don't create mentors manually (coordinators do), 
  // but if they do, we create a mentor document mapped to a dummy or null coordinator.
  const mentorDoc = await Mentor.create({
    authId: user._id,
    state: body.state ? body.state.toUpperCase().trim() : "",
    lgas: body.lgas ? body.lgas.map((lga: string) => lga.toUpperCase().trim()) : []
  });

  const { password: _, ...userData } = user.toObject();
  userData.state = mentorDoc.state;
  userData.lgas = mentorDoc.lgas;

  void _;
  return jsonCreated(userData);
}
