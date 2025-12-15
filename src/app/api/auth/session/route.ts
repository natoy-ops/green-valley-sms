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

function getRefreshTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get("refresh-token")?.value ?? null;
}

function setTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
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
}

export async function GET(request: NextRequest) {
  const accessToken = getAccessTokenFromRequest(request);
  const refreshToken = getRefreshTokenFromRequest(request);

  if (!accessToken && !refreshToken) {
    return formatError(401, "UNAUTHENTICATED", "Not authenticated.");
  }

  const supabase = getAdminSupabaseClient();

  let userId: string;
  let newAccessToken: string | null = null;
  let newRefreshToken: string | null = null;

  // Try to validate the access token first
  if (accessToken) {
    const { data: userResult, error: tokenError } = await supabase.auth.getUser(accessToken);

    if (!tokenError && userResult?.user) {
      userId = userResult.user.id;
    } else if (refreshToken) {
      // Access token is invalid/expired, try to refresh
      const { data: refreshResult, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !refreshResult?.session || !refreshResult.user) {
        return formatError(401, "SESSION_EXPIRED", "Session has expired. Please log in again.");
      }

      userId = refreshResult.user.id;
      newAccessToken = refreshResult.session.access_token;
      newRefreshToken = refreshResult.session.refresh_token;
    } else {
      return formatError(401, "INVALID_TOKEN", "Session is invalid or expired.");
    }
  } else if (refreshToken) {
    // No access token but have refresh token, try to refresh
    const { data: refreshResult, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (refreshError || !refreshResult?.session || !refreshResult.user) {
      return formatError(401, "SESSION_EXPIRED", "Session has expired. Please log in again.");
    }

    userId = refreshResult.user.id;
    newAccessToken = refreshResult.session.access_token;
    newRefreshToken = refreshResult.session.refresh_token;
  } else {
    return formatError(401, "UNAUTHENTICATED", "Not authenticated.");
  }

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

  const response = NextResponse.json(formatSuccess({ user: authUser }));

  // If tokens were refreshed, update the cookies
  if (newAccessToken && newRefreshToken) {
    setTokenCookies(response, newAccessToken, newRefreshToken);
  }

  return response;
}
