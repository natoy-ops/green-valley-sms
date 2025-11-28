/**
 * Session-aware scanning utilities.
 *
 * This module provides logic for determining which session is currently active
 * based on device time and event session configuration, and for computing
 * the appropriate scan status (PRESENT, LATE, DENIED, DUPLICATE).
 */

import type { EventSessionConfig, SessionConfig } from "@/modules/sems/domain/types";

/**
 * Result of finding the active session.
 */
export interface ActiveSessionResult {
  /** Whether a session is currently active */
  isActive: boolean;
  /** The active session config, if any */
  session: SessionConfig | null;
  /** The date string (YYYY-MM-DD) for which the session was found */
  date: string | null;
  /** Reason why scanning is not allowed (if isActive is false) */
  reason: string | null;
}

/**
 * Parses a time string (HH:mm) into total minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats HH:mm time to a friendly format like "7:00 PM" or "9 PM".
 */
function formatTimeFriendly(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  
  if (minutes === 0) {
    return `${hour12} ${period}`;
  }
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Gets the current date in YYYY-MM-DD format using device local time.
 */
export function getCurrentDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Gets the current time in HH:mm format using device local time.
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Finds the currently active session based on device time and session config.
 *
 * Logic:
 * 1. Get current date (YYYY-MM-DD) from device
 * 2. Find the matching date entry in sessionConfig.dates
 * 3. Get current time (HH:mm) from device
 * 4. Find the session where opens <= currentTime <= closes
 *
 * @param sessionConfig - The event's session configuration
 * @returns ActiveSessionResult indicating if/which session is active
 */
export function findActiveSession(
  sessionConfig: EventSessionConfig | null | undefined
): ActiveSessionResult {
  if (!sessionConfig || !sessionConfig.dates || sessionConfig.dates.length === 0) {
    return {
      isActive: false,
      session: null,
      date: null,
      reason: "This event doesn't have scanning sessions set up yet.",
    };
  }

  const currentDate = getCurrentDateString();
  const currentTime = getCurrentTimeString();
  const currentMinutes = parseTimeToMinutes(currentTime);

  // Find the date entry for today
  const todayConfig = sessionConfig.dates.find((d) => d.date === currentDate);

  if (!todayConfig) {
    return {
      isActive: false,
      session: null,
      date: currentDate,
      reason: "No scanning scheduled for today.",
    };
  }

  if (!todayConfig.sessions || todayConfig.sessions.length === 0) {
    return {
      isActive: false,
      session: null,
      date: currentDate,
      reason: "No scanning scheduled for today.",
    };
  }

  // Find the active session based on current time
  for (const session of todayConfig.sessions) {
    const opensMinutes = parseTimeToMinutes(session.opens);
    const closesMinutes = parseTimeToMinutes(session.closes);

    if (currentMinutes >= opensMinutes && currentMinutes <= closesMinutes) {
      return {
        isActive: true,
        session,
        date: currentDate,
        reason: null,
      };
    }
  }

  // No active session found - build a friendly message
  // Find the next upcoming session (if any)
  const upcomingSessions = todayConfig.sessions.filter(
    (s) => parseTimeToMinutes(s.opens) > currentMinutes
  );

  if (upcomingSessions.length > 0) {
    // There's a session coming up later today
    const nextSession = upcomingSessions[0];
    const friendlyTime = formatTimeFriendly(nextSession.opens);
    return {
      isActive: false,
      session: null,
      date: currentDate,
      reason: `Can't scan right now. ${nextSession.name} starts at ${friendlyTime}.`,
    };
  }

  // All sessions for today have ended
  return {
    isActive: false,
    session: null,
    date: currentDate,
    reason: "Scanning is done for today.",
  };
}

/**
 * Determines if a scan should be marked as LATE based on the session's lateAfter threshold.
 *
 * @param session - The active session config
 * @returns true if current time is past the lateAfter threshold
 */
export function isLateForSession(session: SessionConfig): boolean {
  // Exit sessions (direction: "out") don't have a late concept
  if (session.direction === "out") {
    return false;
  }

  // If no lateAfter threshold is set, student is never late
  if (!session.lateAfter) {
    return false;
  }

  const currentTime = getCurrentTimeString();
  const currentMinutes = parseTimeToMinutes(currentTime);
  const lateAfterMinutes = parseTimeToMinutes(session.lateAfter);

  return currentMinutes > lateAfterMinutes;
}

/**
 * Builds a human-readable message for the scan result.
 */
export function buildSessionScanMessage(
  status: "PRESENT" | "LATE" | "DENIED" | "DUPLICATE",
  session: SessionConfig | null,
  customReason?: string | null
): string {
  if (customReason) {
    return customReason;
  }

  const sessionLabel = session?.name ?? "this session";

  switch (status) {
    case "PRESENT":
      return `Checked in on time for ${sessionLabel}.`;
    case "LATE":
      return `Marked as late for ${sessionLabel}.`;
    case "DUPLICATE":
      return `Already scanned for ${sessionLabel}.`;
    case "DENIED":
      return "Scan not allowed.";
    default:
      return "Scan processed.";
  }
}
