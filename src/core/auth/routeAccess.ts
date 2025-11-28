import type { UserRole } from "@/core/auth/types";
import { hasSupportedRole } from "@/config/roles";

interface RouteAccessRule {
  pathPrefix: string;
  allowedRoles: UserRole[];
}

const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  { pathPrefix: "/sis", allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
  { pathPrefix: "/facilities", allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
  // Scanner-focused SEMS route
  { pathPrefix: "/sems/scan", allowedRoles: ["SCANNER", "SUPER_ADMIN", "ADMIN"] },
  // Main SEMS management route: admins only
  { pathPrefix: "/sems", allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
  { pathPrefix: "/dashboard/teacher", allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
  { pathPrefix: "/dashboard", allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
  { pathPrefix: "/scanner", allowedRoles: ["SCANNER", "ADMIN", "SUPER_ADMIN"] },
  { pathPrefix: "/parent", allowedRoles: ["SUPER_ADMIN", "ADMIN"] },
];

export function canAccessRoute(pathname: string, roles: UserRole[]): boolean {
  const rule = ROUTE_ACCESS_RULES.find((r) => pathname.startsWith(r.pathPrefix));

  if (!rule) {
    return hasSupportedRole(roles);
  }

  return roles.some((role) => rule.allowedRoles.includes(role));
}

export function getDefaultRouteForRoles(roles: UserRole[]): string | null {
  if (roles.includes("SUPER_ADMIN") || roles.includes("ADMIN")) {
    return "/dashboard";
  }

  if (roles.includes("TEACHER")) {
    return "/dashboard/teacher";
  }

  if (roles.includes("SCANNER")) {
    return "/sems/scan";
  }

  return "/no-access";
}
