import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATHS = ["/admin", "/admin.html"];

function isAdminSessionCookie(rawCookie: string | null): boolean {
  if (!rawCookie) {
    return false;
  }

  try {
    const parsed = JSON.parse(rawCookie) as { role?: string; email?: string };
    return parsed.role === "admin" && typeof parsed.email === "string" && parsed.email.length > 0;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!ADMIN_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const rawSession = request.cookies.get("kings_auth_session")?.value ?? null;
  if (!isAdminSessionCookie(rawSession)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin.html"],
};
