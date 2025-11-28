"use client";

import { useAuthContext } from "@/core/auth/AuthContext";
import type { UserRole } from "@/core/auth/types";

export function useAuth() {
  const ctx = useAuthContext();

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!ctx.user) return false;
    return ctx.user.roles.some((role) => allowedRoles.includes(role));
  };

  const isSuperAdmin = () => hasRole(["SUPER_ADMIN"]);
  const isAdmin = () => hasRole(["ADMIN", "SUPER_ADMIN"]);
  const isTeacher = () => hasRole(["TEACHER", "ADMIN", "SUPER_ADMIN"]);
  const isScanner = () => hasRole(["SCANNER", "ADMIN", "SUPER_ADMIN"]);
  const isParent = () => hasRole(["PARENT"]);

  return {
    ...ctx,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isTeacher,
    isScanner,
    isParent,
  };
}
