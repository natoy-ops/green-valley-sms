import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import type { AuthUser, UserRole } from "@/core/auth/types";

function formatSuccess<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

function formatError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

interface AppUserRow {
  id: string;
  email: string;
  full_name: string | null;
  roles: UserRole[] | null;
  primary_role: UserRole | null;
  is_active: boolean | null;
  school_id: string | null;
}

function getAccessTokenFromRequest(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }

  const cookieToken = request.cookies.get("auth-token")?.value;

  return cookieToken ?? null;
}

export async function GET(request: NextRequest) {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    return formatError(401, "UNAUTHENTICATED", "Not authenticated.");
  }

  const supabase = getAdminSupabaseClient();

  const { data: userResult, error: tokenError } = await supabase.auth.getUser(accessToken);

  if (tokenError || !userResult?.user) {
    return formatError(401, "INVALID_TOKEN", "Session is invalid or expired.");
  }

  const userId = userResult.user.id;

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, email, full_name, roles, primary_role, is_active, school_id")
    .eq("id", userId)
    .single<AppUserRow>();

  if (appUserError || !appUser) {
    return formatError(403, "ACCOUNT_NOT_FOUND", "Your account is not configured for this system.");
  }

  if (!appUser.is_active) {
    return formatError(403, "ACCOUNT_INACTIVE", "Your account is inactive.");
  }

  const roles = (Array.isArray(appUser.roles) ? appUser.roles : []).filter(Boolean) as UserRole[];
  if (!roles.length) {
    roles.push("STAFF");
  }

  const primaryRole: UserRole = appUser.primary_role ?? roles[0];

  const authUser: AuthUser = {
    id: appUser.id,
    email: appUser.email,
    fullName: appUser.full_name ?? appUser.email,
    roles,
    primaryRole,
    schoolId: appUser.school_id,
    isActive: Boolean(appUser.is_active),
  };

  return NextResponse.json(formatSuccess({ user: authUser }));
}
