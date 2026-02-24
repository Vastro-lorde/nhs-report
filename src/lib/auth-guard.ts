/* ──────────────────────────────────────────
   Auth guard helpers (server-side)
   ────────────────────────────────────────── */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/constants";

/**
 * Get the current session. Returns null if unauthenticated.
 */
export async function getSession() {
  return auth();
}

/**
 * Require authentication. Throws 401 JSON response if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Require specific role(s). Returns 403 if role doesn't match.
 */
export async function requireRole(...roles: UserRole[]) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };

  if (!roles.includes(session!.user.role)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/**
 * Validate cron secret for protected cron endpoints.
 */
export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return authHeader === `Bearer ${expected}`;
}
