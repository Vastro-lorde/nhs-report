/* ──────────────────────────────────────────
   Next.js middleware — lightweight route guard
   Only checks for session cookie presence.
   Full auth validation happens in API route guards.
   ────────────────────────────────────────── */
import { NextResponse, type NextRequest } from "next/server";
import { getMaintenanceConfig } from "@/lib/maintenance";
import { COHORT_VIEW_COOKIE, CohortStatus, decodeCohortViewCookie } from "@/lib/cohort";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const maintenance = getMaintenanceConfig();

  // ─── Maintenance Mode Enforcement ───────────────────
  if (maintenance.enabled) {
    // 1. Static and public asset exemptions
    const isStaticAsset =
      pathname.startsWith("/_next/") ||
      pathname === "/favicon.ico" ||
      pathname === "/logo.png" ||
      pathname === "/icon.png" ||
      pathname === "/robots.txt" ||
      pathname === "/sitemap.xml";

    if (isStaticAsset) {
      return NextResponse.next();
    }

    // 2. Allow status API so the 503 page can query if system is back online
    if (pathname === "/api/maintenance-status") {
      return NextResponse.next();
    }

    // 3. Admin bypass check (via query parameter or cookie)
    const bypassSecret = maintenance.bypassSecret;
    const bypassQuery = req.nextUrl.searchParams.get("bypass");
    const bypassCookie = req.cookies.get("maintenance_bypass")?.value;
    const isBypassed =
      Boolean(bypassSecret) &&
      (bypassQuery === bypassSecret || bypassCookie === bypassSecret);

    if (isBypassed && bypassSecret) {
      const response = NextResponse.next();
      // Persist cookie if query param was supplied
      if (bypassQuery === bypassSecret && bypassCookie !== bypassSecret) {
        response.cookies.set("maintenance_bypass", bypassSecret, {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 60 * 60 * 24, // 24 hours
        });
      }
      return response;
    }

    // 4. API routes: return 503 JSON with Retry-After header
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Service Unavailable",
          message: maintenance.message,
          maintenance: true,
          estimatedUntil: maintenance.estimatedUntil ?? null,
        },
        {
          status: 503,
          headers: {
            "Retry-After": "300",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    // 5. Allow /503 page itself to render
    if (pathname === "/503") {
      return NextResponse.next();
    }

    // 6. Rewrite all other web requests to the 503 page with HTTP 503 status
    const url = req.nextUrl.clone();
    url.pathname = "/503";
    return NextResponse.rewrite(url, {
      status: 503,
      headers: {
        "Retry-After": "300",
      },
    });
  }

  // ─── Normal Application Route Guards ────────────────
  // Public routes — skip auth check
  const publicPaths = [
    "/login",
    "/forgot-password",
    "/set-password",
    "/terms",
    "/privacy-policy",
    "/api/auth",
    "/api/seed",
    "/503",
    "/api/maintenance-status",
  ];
  // The landing page ("/") must stay publicly viewable (exact match only, so
  // it doesn't accidentally allow every route).
  if (pathname === "/" || publicPaths.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    // An admin's "viewing cohort X" choice must not outlive their session on a
    // shared machine — the login page is where every session starts.
    if (pathname === "/login" && req.cookies.has(COHORT_VIEW_COOKIE)) {
      response.cookies.delete(COHORT_VIEW_COOKIE);
    }
    return response;
  }

  // An admin browsing an archived cohort is in read-only mode: refuse writes
  // up front with a clear message (the data layer enforces this too). The
  // cohort endpoints stay open so the admin can switch back.
  const cohortView = decodeCohortViewCookie(req.cookies.get(COHORT_VIEW_COOKIE)?.value);
  if (
    cohortView?.status === CohortStatus.ARCHIVED &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/cohorts") &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    return NextResponse.json(
      {
        error: "You're viewing an archived cohort, which is read-only. Switch back to the current cohort to make changes.",
        cohortReadOnly: true,
      },
      { status: 423 }
    );
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
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png|icon\\.png).*)",
  ],
};
