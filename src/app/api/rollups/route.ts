/* ──────────────────────────────────────────
   API: /api/rollups — get weekly rollup data
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk } from "@/lib/api-helpers";
import { getRecentRollups, getRollup } from "@/services/rollup.service";

// GET /api/rollups?weekKey=2026-W08 or GET /api/rollups (latest 12)
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const weekKey = url.searchParams.get("weekKey");

  if (weekKey) {
    const rollup = await getRollup(weekKey);
    return jsonOk(rollup);
  }

  const rollups = await getRecentRollups(12);
  return jsonOk(rollups);
}
