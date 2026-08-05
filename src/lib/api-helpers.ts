/* ──────────────────────────────────────────
   Shared API response helpers
   ────────────────────────────────────────── */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/** Parse JSON body safely */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Parse pagination query params */
export function parsePagination(url: URL): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Higher-order route handler that catches unhandled errors, logs them
 * as ExceptionLogs, and returns a 500 response instead of crashing.
 *
 * Usage:
 *   export const POST = withExceptionLog("POST /api/reports", async (req) => { ... });
 */
export function withExceptionLog<Args extends [NextRequest, ...unknown[]]>(
  context: string,
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      // Dynamic import to avoid circular dep issues at module init time
      const { logException } = await import("@/lib/exception-logger");
      void logException({ error: err, context });
      console.error(`[${context}] Unhandled error:`, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
