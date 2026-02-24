/* ──────────────────────────────────────────
   API: /api/alerts — list & manage alerts
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Alert } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, parsePagination } from "@/lib/api-helpers";

// GET /api/alerts
export async function GET(request: NextRequest) {
  const { error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR);
  if (error) return error;

  await connectDB();

  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);

  const filter: Record<string, unknown> = {};
  const status = url.searchParams.get("status");
  const weekKey = url.searchParams.get("weekKey");

  if (status) filter.status = status;
  if (weekKey) filter.weekKey = weekKey;

  const [alerts, total] = await Promise.all([
    Alert.find(filter)
      .populate("mentor", "name email state")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Alert.countDocuments(filter),
  ]);

  return jsonOk({
    data: alerts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
