"use client";

import useSWR from "swr";
import type { AuthUser } from "@/core/auth/types";

const SESSION_ENDPOINT = "/api/auth/session";

interface SessionResponse {
  success: boolean;
  data?: { user: AuthUser };
}

async function sessionFetcher(url: string): Promise<AuthUser | null> {
  const res = await fetch(url, { method: "GET" });

  if (res.status === 401 || res.status === 403) {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as SessionResponse;

  if (!body.success || !body.data) {
    return null;
  }

  return body.data.user;
}

export interface UseSessionOptions {
  /** Revalidate interval in milliseconds. Default: 5 minutes */
  refreshInterval?: number;
  /** Whether to revalidate on window focus. Default: false */
  revalidateOnFocus?: boolean;
  /** Whether to revalidate on network reconnect. Default: false */
  revalidateOnReconnect?: boolean;
}

const DEFAULT_OPTIONS: Required<UseSessionOptions> = {
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useSession(options: UseSessionOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const { data, error, isLoading, isValidating, mutate } = useSWR<AuthUser | null>(
    SESSION_ENDPOINT,
    sessionFetcher,
    {
      revalidateOnFocus: config.revalidateOnFocus,
      revalidateOnReconnect: config.revalidateOnReconnect,
      refreshInterval: config.refreshInterval,
      dedupingInterval: 60000, // Dedupe requests within 1 minute
      errorRetryCount: 2,
      shouldRetryOnError: false,
      revalidateIfStale: false, // Don't auto-revalidate stale data
      revalidateOnMount: true, // Fetch on mount
    }
  );

  return {
    user: data ?? null,
    isLoading,
    isValidating,
    isAuthenticated: !!data,
    error,
    /** Force refresh the session */
    refresh: () => mutate(),
    /** Clear the session (for logout) */
    clear: () => mutate(null, false),
  };
}
