/* ──────────────────────────────────────────
   Cron: /api/cron/rollups — rebuild all rollups
   Protected by CRON_SECRET bearer token
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { rebuildAllRollups } from "@/services/rollup.service";

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  await rebuildAllRollups();
  return jsonOk({ message: "All rollups rebuilt" });
}
