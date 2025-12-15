"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/core/auth/types";
import { login as authLogin, performLogout } from "@/core/auth/AuthService";
import { initializeSessionTracking } from "@/core/auth/SessionService";
import { getDefaultRouteForRoles } from "@/core/auth/routeAccess";
import { useSession } from "@/core/auth/useSession";

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
  const { user, isLoading, isAuthenticated, refresh, clear } = useSession({
    refreshInterval: 5 * 60 * 1000, // Refresh session every 5 minutes
    revalidateOnFocus: false, // Don't refetch on tab focus
    revalidateOnReconnect: false, // Don't refetch on network reconnect
  });
  const currentPathname = usePathname();

  // Initialize session tracking on mount
  useEffect(() => {
    console.log("[AuthContext] mount: initializing session tracking");
    initializeSessionTracking();
  }, []);

  // Redirect guard - only redirects if not authenticated and not on login page
  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (typeof window === "undefined") return;

    const path = currentPathname ?? window.location.pathname;
    if (path === "/login") return;
    if (isAuthenticated) return;

    console.log("[AuthContext] redirecting to /login because user is not authenticated");
    window.location.href = "/login";
  }, [isLoading, isAuthenticated, currentPathname]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      console.log("[AuthContext] handleLogin called", { email });
      const loggedInUser = await authLogin(email, password);
      console.log("[AuthContext] handleLogin succeeded", {
        userId: loggedInUser.id,
        roles: loggedInUser.roles,
      });

      // Update SWR cache with the logged-in user
      await refresh();

      const target = getDefaultRouteForRoles(loggedInUser.roles) ?? "/";
      console.log("[AuthContext] redirecting after login", { target });
      window.location.href = target;
    },
    [refresh]
  );

  const handleLogout = useCallback(async () => {
    console.log("[AuthContext] handleLogout called");
    await performLogout();

    // Clear the SWR cache
    clear();

    console.log("[AuthContext] redirecting to /login after logout");
    window.location.href = "/login";
  }, [clear]);

  const handleRefreshUser = useCallback(async () => {
    console.log("[AuthContext] refreshUser called");
    await refresh();
  }, [refresh]);

  const value: AuthContextValue = {
    user,
    loading: isLoading,
    isAuthenticated,
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
