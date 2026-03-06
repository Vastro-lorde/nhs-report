/* ──────────────────────────────────────────
   Cron: /api/cron/rollups — rebuild all rollups
   Protected by CRON_SECRET bearer token
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { rebuildAllRollups } from "@/services/rollup.service";

async function handle(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  await rebuildAllRollups();
  return jsonOk({ message: "All rollups rebuilt" });
}

// Vercel Cron Jobs trigger via GET
export async function GET(request: NextRequest) {
  return handle(request);
}

// Keep POST for manual runs/tools
export async function POST(request: NextRequest) {
  return handle(request);
}
