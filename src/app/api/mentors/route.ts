/* ──────────────────────────────────────────
   API: /api/mentors — CRUD for mentors
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Mentor, Coordinator, DeskOfficer } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, parsePagination } from "@/lib/api-helpers";

// GET /api/mentors — list mentors (admin/coordinator)
export async function GET(request: NextRequest) {
  const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER);
  if (error) return error;

  await connectDB();

  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);

  const filter: Record<string, unknown> = { role: UserRole.MENTOR };
  const search = url.searchParams.get("search");

  // Mentor-specific filters
  const mentorFilter: Record<string, unknown> = {};
  const states = url.searchParams.get("states");
  const requestedStates = states
    ? states
        .split(",")
        .map((s) => s.toUpperCase().trim())
        .filter(Boolean)
    : [];

  // Coordinators must only see mentors under their own scope
  if (session?.user?.role === UserRole.COORDINATOR) {
    const coordinator = await Coordinator.findOne({ authId: session.user.id }).lean();
    if (!coordinator) return jsonError("Coordinator record not found", 404);

    const allowedStates = (coordinator.states || []).map((s) => s.toUpperCase().trim()).filter(Boolean);
    mentorFilter.coordinator = coordinator._id;

    if (requestedStates.length) {
      if (allowedStates.length) {
        const allowedSet = new Set(allowedStates);
        const intersection = requestedStates.filter((s) => allowedSet.has(s));
        mentorFilter.states = { $in: intersection };
      } else {
        mentorFilter.states = { $in: requestedStates };
      }
    } else {
      if (allowedStates.length) mentorFilter.states = { $in: allowedStates };
    }
  } else {
    if (session?.user?.role === UserRole.ZONAL_DESK_OFFICER) {
      const deskOfficer = await DeskOfficer.findOne({ authId: session.user.id }).lean();
      if (!deskOfficer) return jsonError("Desk officer record not found", 404);

      const allowedStates = (deskOfficer.states || []).map((s) => s.toUpperCase().trim()).filter(Boolean);
      if (!allowedStates.length) {
        return jsonOk({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }

      if (requestedStates.length) {
        const allowedSet = new Set(allowedStates);
        const intersection = requestedStates.filter((s) => allowedSet.has(s));
        mentorFilter.states = { $in: intersection };
      } else {
        mentorFilter.states = { $in: allowedStates };
      }
    } else {
      if (requestedStates.length) mentorFilter.states = { $in: requestedStates };
    }
  }

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
  const userIds = users.map(u => u._id);

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
      states: md?.states || [],
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
  states?: string[];
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
    states: body.states ? body.states.map((s: string) => s.toUpperCase().trim()) : [],
    lgas: body.lgas ? body.lgas.map((lga: string) => lga.toUpperCase().trim()) : []
  });

  const userObj = user.toObject() as unknown as Record<string, unknown>;
  const { password, ...safeUser } = userObj;
  void password;
  return jsonCreated({ ...safeUser, states: mentorDoc.states, lgas: mentorDoc.lgas });
}
