"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/core/auth/types";
import { login as authLogin, getCurrentUser, performLogout } from "@/core/auth/AuthService";
import { initializeSessionTracking } from "@/core/auth/SessionService";
import { getDefaultRouteForRoles } from "@/core/auth/routeAccess";
import { getBrowserSupabaseClient } from "@/core/db/supabase-client.browser";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const currentPathname = usePathname();

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const current = await getCurrentUser();
      setUser(current);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("[AuthContext] mount: initializing session tracking and loading user");
    initializeSessionTracking();
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const supabase = getBrowserSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthContext] onAuthStateChange", { event, hasSession: !!session });

      if (!session) {
        const path = typeof window !== "undefined" ? window.location.pathname : currentPathname;
        console.log("[AuthContext] onAuthStateChange: no session, clearing user", { path });
        // Just clear the user; the redirect guard + getCurrentUser (cookie-based)
        // will decide when to send the user back to /login.
        setUser(null);
        return;
      }

      console.log("[AuthContext] onAuthStateChange: session present, reloading user");
      void loadUser();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = currentPathname ?? window.location.pathname;
    console.log("[AuthContext] route change detected, validating session", { path });
    if (path === "/login") {
      console.log("[AuthContext] route is /login, skipping session validation");
      return;
    }

    void loadUser();
  }, [currentPathname, loadUser]);

  useEffect(() => {
    if (loading) {
      console.log("[AuthContext] redirect guard: still loading, skip redirect");
      return;
    }
    if (typeof window === "undefined") return;

    const path = currentPathname ?? window.location.pathname;
    console.log("[AuthContext] redirect guard check", { path, hasUser: !!user });
    if (path === "/login") return;
    if (user) return;

    console.log("[AuthContext] redirecting to /login because user is null");
    window.location.href = "/login";
  }, [loading, user, currentPathname]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    console.log("[AuthContext] handleLogin called", { email });
    const loggedInUser = await authLogin(email, password);
    console.log("[AuthContext] handleLogin succeeded", {
      userId: loggedInUser.id,
      roles: loggedInUser.roles,
    });
    setUser(loggedInUser);
    const target = getDefaultRouteForRoles(loggedInUser.roles) ?? "/";
    console.log("[AuthContext] redirecting after login", { target });
    window.location.href = target;
  }, []);

  const handleLogout = useCallback(async () => {
    console.log("[AuthContext] handleLogout called");
    await performLogout();
    setUser(null);
    console.log("[AuthContext] redirecting to /login after logout");
    window.location.href = "/login";
  }, []);

  const handleRefreshUser = useCallback(async () => {
    console.log("[AuthContext] refreshUser called");
    const current = await getCurrentUser();
    console.log("[AuthContext] refreshUser loaded user", { hasUser: !!current });
    setUser(current);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    login: handleLogin,
    logout: handleLogout,
    refreshUser: handleRefreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
