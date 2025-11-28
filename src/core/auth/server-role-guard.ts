import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/core/auth/types";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { ALL_USER_ROLES } from "@/config/roles";

export interface RoleGuardUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: UserRole[];
  primaryRole: UserRole;
  isActive: boolean;
}

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  const cookieToken = request.cookies.get("auth-token")?.value;
  return cookieToken ?? null;
}

function normalizeRoles(roles: string[] | null | undefined): UserRole[] {
  if (!Array.isArray(roles)) return [];

  const normalized = roles
    .map((role) => (typeof role === "string" ? role.toUpperCase() : ""))
    .filter(Boolean) as string[];

  const unique = Array.from(new Set(normalized));

  return unique.filter((role): role is UserRole => ALL_USER_ROLES.includes(role as UserRole));
}

interface GuardResult {
  appUser: RoleGuardUser;
  supabaseUser: User;
}

function buildErrorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export async function requireRoles(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<GuardResult | { error: NextResponse }> {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    return {
      error: buildErrorResponse(401, "UNAUTHENTICATED", "Not authenticated."),
    };
  }

  const supabase = getAdminSupabaseClient();

  const { data: userResult, error: tokenError } = await supabase.auth.getUser(accessToken);

  if (tokenError || !userResult?.user) {
    return {
      error: buildErrorResponse(
        401,
        "INVALID_TOKEN",
        "Session is invalid or expired.",
        tokenError?.message ?? tokenError
      ),
    };
  }

  const userId = userResult.user.id;

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, email, full_name, roles, primary_role, is_active")
    .eq("id", userId)
    .single<{ id: string; email: string; full_name: string | null; roles: string[] | null; primary_role: string | null; is_active: boolean | null }>();

  if (appUserError || !appUser) {
    return {
      error: buildErrorResponse(
        403,
        "ACCOUNT_NOT_FOUND",
        "Your account is not configured for this system.",
        appUserError?.message ?? appUserError
      ),
    };
  }

  if (appUser.is_active === false) {
    return {
      error: buildErrorResponse(403, "ACCOUNT_INACTIVE", "Your account is inactive."),
    };
  }

  const roles = normalizeRoles(appUser.roles);
  const primaryRole =
    (appUser.primary_role && normalizeRoles([appUser.primary_role])[0]) || roles[0];

  if (primaryRole && !roles.includes(primaryRole)) {
    roles.push(primaryRole);
  }

  if (!roles.length && primaryRole) {
    roles.push(primaryRole);
  }

  if (allowedRoles.length > 0 && !roles.some((role) => allowedRoles.includes(role))) {
    return {
      error: buildErrorResponse(403, "FORBIDDEN", "You are not allowed to perform this action."),
    };
  }

  const normalizedPrimary = primaryRole ?? roles[0] ?? "SUPER_ADMIN";
  const isActive = appUser.is_active ?? true;

  return {
    appUser: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.full_name,
      roles,
      primaryRole: normalizedPrimary,
      isActive,
    },
    supabaseUser: userResult.user,
  };
}
