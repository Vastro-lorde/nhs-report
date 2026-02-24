/* ──────────────────────────────────────────
   Shared API response helpers
   ────────────────────────────────────────── */
import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
