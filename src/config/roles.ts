import type { UserRole } from "@/core/auth/types";

export const ALL_USER_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SCANNER",
  "TEACHER",
  "STAFF",
  "PARENT",
] as const;

export const ADMIN_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN"] as const;

export const ADMIN_SCANNER_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SCANNER",
] as const;

export const SUPPORTED_APP_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SCANNER",
] as const;

export function hasSupportedRole(roles: UserRole[]): boolean {
  return roles.some((role) => SUPPORTED_APP_ROLES.includes(role));
}

export function isAdministrativeRole(roles: UserRole[]): boolean {
  return roles.some((role) => role === "SUPER_ADMIN" || role === "ADMIN");
}
