"use client";

import { getBrowserSupabaseClient } from "@/core/db/supabase-client.browser";
import type { AuthUser } from "@/core/auth/types";

interface LoginResponse {
  success: boolean;
  data?: {
    user: AuthUser;
    session?: {
      access_token: string;
      refresh_token: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

const LOGIN_ENDPOINT = "/api/auth/login";
const LOGOUT_ENDPOINT = "/api/auth/logout";
const SESSION_ENDPOINT = "/api/auth/session";

export async function login(email: string, password: string): Promise<AuthUser> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    console.log("[AuthService.login] Sending login request", {
      endpoint: LOGIN_ENDPOINT,
      email,
    });

    const res = await fetch(LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    console.log("[AuthService.login] Received response", {
      status: res.status,
      ok: res.ok,
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as LoginResponse | null;
      const message = body?.error?.message ?? "Unable to sign in. Check your credentials and try again.";
      console.error("[AuthService.login] Login failed", {
        status: res.status,
        error: body?.error,
      });
      throw new Error(message);
    }

    const body = (await res.json()) as LoginResponse;
    if (!body.success || !body.data) {
      console.error("[AuthService.login] Unexpected login response shape", {
        body,
      });
      throw new Error(body.error?.message ?? "Unexpected login response.");
    }

    const { user, session } = body.data;

    console.log("[AuthService.login] Login succeeded", {
      userId: user.id,
      roles: user.roles,
      hasSession: !!session,
    });

    if (session) {
      const supabase = getBrowserSupabaseClient();
      supabase.auth
        .setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        .catch((err) => {
          console.error("[AuthService.login] Failed to set Supabase session", err);
          // Session in Supabase is best-effort; cookies remain source of truth.
        });
    }

    return user;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  console.log("[AuthService.getCurrentUser] Fetching current user via", SESSION_ENDPOINT);

  const res = await fetch(SESSION_ENDPOINT, {
    method: "GET",
  });

  console.log("[AuthService.getCurrentUser] Response", {
    status: res.status,
    ok: res.ok,
  });

  if (res.status === 401 || res.status === 403) {
    console.log("[AuthService.getCurrentUser] Not authenticated (401/403)");
    return null;
  }

  if (!res.ok) {
    console.error("[AuthService.getCurrentUser] Unexpected error status", res.status);
    return null;
  }

  const body = (await res.json()) as {
    success: boolean;
    data?: { user: AuthUser };
  };

  if (!body.success || !body.data) {
    console.log("[AuthService.getCurrentUser] No user in response body", body);
    return null;
  }

  console.log("[AuthService.getCurrentUser] Loaded user", {
    userId: body.data.user.id,
    roles: body.data.user.roles,
  });

  return body.data.user;
}

export async function performLogout(): Promise<void> {
  await fetch(LOGOUT_ENDPOINT, { method: "POST" });

  const supabase = getBrowserSupabaseClient();
  await supabase.auth.signOut();
}
