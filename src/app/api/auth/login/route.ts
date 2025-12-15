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

function formatError(status: number, code: string, message: string, details?: unknown) {
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

interface AppUserRow {
  id: string;
  email: string;
  full_name: string | null;
  roles: UserRole[] | null;
  primary_role: UserRole | null;
  is_active: boolean | null;
  school_id: string | null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;

  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";

  if (!email || !password) {
    return formatError(400, "VALIDATION_ERROR", "Email and password are required.");
  }

  const supabase = getAdminSupabaseClient();

  let authResult;
  let authError;
  try {
    const authResponse = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    authResult = authResponse.data;
    authError = authResponse.error;
  } catch (err) {
    console.error("[/api/auth/login] Supabase signInWithPassword failed", err);
    return formatError(
      503,
      "AUTH_SERVICE_UNAVAILABLE",
      "Authentication service is temporarily unavailable. Please try again in a few minutes.",
      err instanceof Error
        ? { name: err.name, message: err.message }
        : err
    );
  }

  if (authError || !authResult?.session || !authResult.user) {
    return formatError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const userId = authResult.user.id;

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, email, full_name, roles, primary_role, is_active, school_id")
    .eq("id", userId)
    .single<AppUserRow>();

  if (appUserError || !appUser) {
    console.error("[/api/auth/login] Failed to load app_users row", {
      userId,
      appUserError,
      appUser,
    });
    return formatError(
      403,
      "ACCOUNT_NOT_FOUND",
      "Your account is not configured for this system. Contact the Super Admin.",
      appUserError ?? null,
    );
  }

  if (!appUser.is_active) {
    return formatError(403, "ACCOUNT_INACTIVE", "Your account is inactive. Contact the Super Admin.");
  }

  const roles = (Array.isArray(appUser.roles) ? appUser.roles : []).filter(Boolean) as UserRole[];
  if (!roles.length) {
    roles.push("STAFF");
  }

  const primaryRole: UserRole = appUser.primary_role ?? roles[0];

  const user: AuthUser = {
    id: appUser.id,
    email: appUser.email,
    fullName: appUser.full_name ?? appUser.email,
    roles,
    primaryRole,
    schoolId: appUser.school_id,
    isActive: Boolean(appUser.is_active),
  };

  const lastLoginAt = authResult.user.last_sign_in_at ?? new Date().toISOString();

  console.log("[/api/auth/login] Attempting to update last_login_at", {
    userId,
    supabaseLastSignInAt: authResult.user.last_sign_in_at,
    effectiveLastLoginAt: lastLoginAt,
  });

  const { error: lastLoginUpdateError } = await supabase
    .from("app_users")
    .update({ last_login_at: lastLoginAt })
    .eq("id", userId);

  if (lastLoginUpdateError) {
    console.error("[/api/auth/login] Failed to update last_login_at", {
      userId,
      lastLoginUpdateError,
    });
  } else {
    console.log("[/api/auth/login] Successfully updated last_login_at", {
      userId,
      lastLoginAt,
    });
  }

  const accessToken = authResult.session.access_token;
  const refreshToken = authResult.session.refresh_token;

  const response = NextResponse.json(
    formatSuccess({
      user,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    })
  );

  const twelveHoursInSeconds = 60 * 60 * 12;
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("auth-token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: twelveHoursInSeconds,
  });

  response.cookies.set("refresh-token", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: twelveHoursInSeconds,
  });

  response.cookies.set("user-id", user.id, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: twelveHoursInSeconds,
  });

  response.cookies.set("user-roles", JSON.stringify(user.roles), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: twelveHoursInSeconds,
  });

  if (user.schoolId) {
    response.cookies.set("school-id", user.schoolId, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: twelveHoursInSeconds,
    });
  }

  return response;
}
