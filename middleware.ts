import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessRoute, getDefaultRouteForRoles } from "@/core/auth/routeAccess";
import type { UserRole } from "@/core/auth/types";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth-token")?.value;
  const rolesCookie = request.cookies.get("user-roles")?.value;

  if (!token || !rolesCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  let roles: UserRole[] = [];
  try {
    const parsed = JSON.parse(rolesCookie) as UserRole[];
    if (Array.isArray(parsed)) {
      roles = parsed;
    }
  } catch {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(pathname, roles)) {
    const target = getDefaultRouteForRoles(roles) ?? "/";
    const url = new URL(target, request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)"]
};
