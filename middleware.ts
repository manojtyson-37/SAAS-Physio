import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const COOKIE_NAME = "physiocare_session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  const { pathname } = req.nextUrl;

  const isAppRoute = pathname.startsWith("/app");
  const isLoginRoute = pathname === "/login";

  // API requests: stamp the real HTTP method for the subscription gate (clients cannot spoof it, it is overwritten here).
  if (pathname.startsWith("/api/")) {
    const h = new Headers(req.headers);
    h.set("x-cos-method", req.method);
    return NextResponse.next({ request: { headers: h } });
  }

  if (isAppRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // The onboarding team only ever sees the platform console and its own account page.
  if (isAppRoute && session?.role === "ONBOARDING" && !(pathname === "/app/platform" || pathname.startsWith("/app/platform/"))) {
    return NextResponse.redirect(new URL("/app/platform", req.url));
  }
  if (isAppRoute && session && session.role !== "ONBOARDING" && session.role !== "SUPER_ADMIN" && (pathname === "/app/platform" || pathname.startsWith("/app/platform/"))) {
    return NextResponse.redirect(new URL("/app", req.url));
  }
  if (isAppRoute && pathname.startsWith("/app/clinics")) {
    return NextResponse.redirect(new URL("/app/platform", req.url));
  }

  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/api/:path*"],
};
