/* ──────────────────────────────────────────
   API: /api/seed — seed route (dev only)
   Creates one user per role: admin, coordinator, mentor
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Coordinator, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { jsonOk, jsonError } from "@/lib/api-helpers";

const SEED_USERS = [
  {
    name: "System Admin",
    email: "admin@mailinator.com",
    password: "admin123",
    role: UserRole.ADMIN,
    rootAdmin: true,
    state: "FCT",
    lgas: [],
  },
  {
    name: "State Coordinator",
    email: "coordinator@mailinator.com",
    password: "coord123",
    role: UserRole.COORDINATOR,
    state: "Edo",
    lgas: ["Etsako West", "Etsako East", "Owan West"],
  },
  {
    name: "Alhaji Bello Ibrahim",
    email: "mentor@mailinator.com",
    password: "mentor123",
    role: UserRole.MENTOR,
    state: "Edo",
    lgas: ["Etsako West", "Etsako East"],
  },
];

export async function POST(_request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return jsonError("Not available in production", 403);
  }

  await connectDB();

  const created: { email: string; role: string; password: string }[] = [];
  const skipped: string[] = [];

  for (const seed of SEED_USERS) {
    const existing = await User.findOne({ email: seed.email });
    if (existing) {
      skipped.push(seed.email);
      continue;
    }

    const hashedPassword = await bcrypt.hash(seed.password, 12);
    const user = await User.create({
      name: seed.name,
      email: seed.email,
      password: hashedPassword,
      role: seed.role,
      rootAdmin: seed.rootAdmin ?? false,
      active: true,
    });

    if (seed.role === UserRole.COORDINATOR) {
      await Coordinator.create({
        authId: user._id,
        states: seed.state ? [seed.state.toUpperCase()] : []
      });
    } else if (seed.role === UserRole.MENTOR) {
      // Find the coordinator to assign to this mentor
      const coordUser = await User.findOne({ role: UserRole.COORDINATOR });
      let coordinatorId = null;
      if (coordUser) {
        const coord = await Coordinator.findOne({ authId: coordUser._id });
        if (coord) coordinatorId = coord._id;
      }

      await Mentor.create({
        authId: user._id,
        ...(coordinatorId ? { coordinator: coordinatorId } : {}),
        state: seed.state ? seed.state.toUpperCase() : "",
        lgas: seed.lgas ? seed.lgas.map(l => l.toUpperCase()) : []
      });
    }

    created.push({ email: seed.email, role: seed.role, password: seed.password });
  }

  return jsonOk({
    message: `Seeded ${created.length} user(s), skipped ${skipped.length}`,
    created,
    skipped,
  });
}
