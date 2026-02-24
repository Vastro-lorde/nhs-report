/* ──────────────────────────────────────────
   Next.js middleware — protect app routes
   ────────────────────────────────────────── */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  const publicPaths = ["/login", "/api/auth"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cron routes use bearer token, not session
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Protect everything else
  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all routes except static assets and _next
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
