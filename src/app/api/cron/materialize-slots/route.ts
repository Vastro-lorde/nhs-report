/* ──────────────────────────────────────────
   Cron: /api/cron/materialize-slots
   Rolls the availability window forward by materializing
   concrete TimeSlots from active recurring templates.
   Protected by CRON_SECRET bearer token.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { materializeAllMentorSlots } from "@/services/slot.service";

async function handle(request: NextRequest) {
    if (!validateCronSecret(request)) {
        return jsonError("Unauthorized", 401);
    }

    await connectDB();
    const result = await materializeAllMentorSlots();
    return jsonOk({ message: "Slots materialized", ...result });
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
