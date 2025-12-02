import type { UserRole } from "@/core/auth/types";
import { ALL_USER_ROLES, hasSupportedRole } from "@/config/roles";

interface RouteAccessRule {
  pathPrefix: string;
  allowedRoles: UserRole[];
}

const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  { pathPrefix: "/sis", allowedRoles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  { pathPrefix: "/facilities", allowedRoles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"] },
  { pathPrefix: "/profile", allowedRoles: [...ALL_USER_ROLES] },
  // Scanner-focused SEMS route
  { pathPrefix: "/sems/scan", allowedRoles: ["SCANNER", "SUPER_ADMIN", "ADMIN"] },
  // Student-facing SEMS route: students can view their own events
  { pathPrefix: "/sems/student-events", allowedRoles: ["STUDENT"] },
  // Parent-facing SEMS route: parents can view child events
  { pathPrefix: "/sems/parent-events", allowedRoles: ["PARENT"] },
  // Main SEMS management route: admins, teachers, and staff
  { pathPrefix: "/sems", allowedRoles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"] },
  { pathPrefix: "/dashboard/teacher", allowedRoles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  { pathPrefix: "/dashboard", allowedRoles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"] },
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

  if (roles.includes("STAFF")) {
    return "/dashboard";
  }

  if (roles.includes("SCANNER")) {
    return "/sems/scan";
  }

  if (roles.includes("STUDENT")) {
    return "/sems/student-events";
  }

  if (roles.includes("PARENT")) {
    return "/sems/parent-events";
  }

  return "/no-access";
}
