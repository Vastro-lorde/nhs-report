/* ──────────────────────────────────────────
   Next.js middleware — lightweight route guard
   Only checks for session cookie presence.
   Full auth validation happens in API route guards.
   ────────────────────────────────────────── */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — skip auth check
  const publicPaths = ["/login", "/api/auth", "/api/seed"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cron routes use bearer token, not session
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie (works in edge runtime)
  const sessionCookie =
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie?.value) {
    // API routes get a 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except static assets and _next
     */
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png).*)",
  ],
};
