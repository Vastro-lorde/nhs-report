/* ──────────────────────────────────────────
   API: /api/alerts — list & manage alerts
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Alert, Coordinator, DeskOfficer, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
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

  if (session!.user.role === UserRole.COORDINATOR) {
    const coordinatorDoc = await Coordinator.findOne({ authId: session!.user.id });
    if (coordinatorDoc) {
      // Alert.mentor stores User IDs (authId), so get mentor authIds under this coordinator
      const mentorAuthIds = await Mentor.find({ coordinator: coordinatorDoc._id }).distinct("authId");
      filter.mentor = { $in: mentorAuthIds };
    } else {
      return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
  } else if (session!.user.role === UserRole.ZONAL_DESK_OFFICER) {
    const deskOfficerDoc = await DeskOfficer.findOne({ authId: session!.user.id });
    if (deskOfficerDoc && deskOfficerDoc.states && deskOfficerDoc.states.length > 0) {
      filter.state = { $in: deskOfficerDoc.states };
    } else {
      return jsonOk({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
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
