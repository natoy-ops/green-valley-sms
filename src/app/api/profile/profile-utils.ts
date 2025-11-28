import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import type { UserRole } from "@/core/auth/types";

export const ALLOWED_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "SCANNER",
  "TEACHER",
  "STAFF",
  "PARENT",
];

export interface AppUserRow {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[] | null;
  primary_role: string | null;
  is_active: boolean | null;
  school_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface ProfileDto {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  primaryRole: UserRole;
  isActive: boolean;
  schoolId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  lastSignInAt: string | null;
}

export function formatSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export function formatError(status: number, code: string, message: string, details?: unknown) {
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

export function normalizeRoles(roles: string[] | null | undefined): UserRole[] {
  if (!Array.isArray(roles)) return [];

  const upper = roles
    .map((role) => (typeof role === "string" ? role.toUpperCase() : ""))
    .filter(Boolean) as string[];

  const unique = Array.from(new Set(upper));

  return unique.filter((role): role is UserRole => ALLOWED_ROLES.includes(role as UserRole));
}

export function mapAppUserToProfileDto(row: AppUserRow, lastSignInAt?: string | null): ProfileDto {
  const roles = normalizeRoles(row.roles);
  let primaryRole: UserRole =
    (row.primary_role && normalizeRoles([row.primary_role])[0]) || roles[0] || "STAFF";

  if (!roles.length) {
    roles.push(primaryRole);
  }

  if (!roles.includes(primaryRole)) {
    roles.push(primaryRole);
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.email,
    roles,
    primaryRole,
    isActive: Boolean(row.is_active ?? true),
    schoolId: row.school_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    lastSignInAt: lastSignInAt ?? null,
  };
}

export async function fetchCurrentAppUser(request: NextRequest): Promise<
  | { supabaseUser: User; appUser: AppUserRow }
  | { error: NextResponse }
> {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    return { error: formatError(401, "UNAUTHENTICATED", "Not authenticated.") };
  }

  const supabase = getAdminSupabaseClient();

  const { data: userResult, error: tokenError } = await supabase.auth.getUser(accessToken);

  if (tokenError || !userResult?.user) {
    return { error: formatError(401, "INVALID_TOKEN", "Session is invalid or expired.") };
  }

  const userId = userResult.user.id;

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select(
      "id, email, full_name, roles, primary_role, is_active, school_id, created_at, updated_at, created_by, updated_by"
    )
    .eq("id", userId)
    .single<AppUserRow>();

  if (appUserError || !appUser) {
    return {
      error: formatError(
        403,
        "ACCOUNT_NOT_FOUND",
        "Your account is not configured for this system.",
        appUserError?.message ?? appUserError
      ),
    };
  }

  if (appUser.is_active === false) {
    return { error: formatError(403, "ACCOUNT_INACTIVE", "Your account is inactive.") };
  }

  return { supabaseUser: userResult.user, appUser };
}
