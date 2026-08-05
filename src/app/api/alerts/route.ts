/* ──────────────────────────────────────────
   API: /api/alerts — list & manage alerts
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Alert, Coordinator, DeskOfficer, Mentor } from "@/models";
import { UserRole, normalizeLocation } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, parsePagination } from "@/lib/api-helpers";

// GET /api/alerts
export async function GET(request: NextRequest) {
  const { session, error } = await requireRole(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD);
  if (error) return error;

  await connectDB();

  const url = new URL(request.url);
  const { page, limit, skip } = parsePagination(url);

  const filter: Record<string, unknown> = {};
  const status = url.searchParams.get("status");
  const weekKey = url.searchParams.get("weekKey");

  if (status) filter.status = status;
  if (weekKey) filter.weekKey = weekKey;

  /**
   * Alert.mentor references User (authId), but older rows were written with the
   * Mentor document id — match on both so no alert is silently dropped.
   */
  async function mentorRefsFor(mentorQuery: Record<string, unknown>) {
    const docs = await Mentor.find(mentorQuery).select("_id authId").lean();
    return docs.flatMap((m) => [m.authId, m._id]);
  }

  if (session!.user.role === UserRole.COORDINATOR) {
    const coordinatorDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (coordinatorDoc) {
      filter.mentor = { $in: await mentorRefsFor({ coordinator: coordinatorDoc._id }) };
    } else {
      return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
  } else if (session!.user.role === UserRole.ZONAL_DESK_OFFICER) {
    const deskOfficerDoc = await DeskOfficer.findOne({ authId: session!.user.id });
    const officerStates = (deskOfficerDoc?.states ?? []).map((s) => normalizeLocation(s)).filter(Boolean);
    if (!officerStates.length) {
      return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
    // Resolve through the mentors working in these states rather than the
    // alert's single `state` field: a mentor covering two states only ever
    // stamped the first one, so alerts went missing from the other zone.
    filter.mentor = { $in: await mentorRefsFor({ states: { $in: officerStates } }) };
  }

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
