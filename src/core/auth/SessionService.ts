"use client";

const SESSION_KEY = "usms_session_meta";

interface SessionMeta {
  lastActivity: number;
}

function readMeta(): SessionMeta | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: SessionMeta): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(meta));
  } catch {
    // Best-effort only; failure should not break auth.
  }
}

function touchActivity(): void {
  writeMeta({ lastActivity: Date.now() });
}

let initialized = false;

export function initializeSessionTracking(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const handler = () => touchActivity();

  window.addEventListener("mousedown", handler);
  window.addEventListener("keydown", handler);
  window.addEventListener("scroll", handler);
  window.addEventListener("touchstart", handler);

  touchActivity();
}

export function getLastActivity(): number | null {
  const meta = readMeta();
  return meta?.lastActivity ?? null;
}
