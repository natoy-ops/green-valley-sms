/**
 * Venue Availability API Endpoint
 *
 * Checks venue availability based on session-level time slot conflicts.
 *
 * @remarks
 * Frontend Integration:
 * - Call this endpoint when user selects dates and configures sessions
 * - Pass sessions as JSON in the `sessions` query parameter
 * - Results include per-venue availability status and conflict details
 *
 * @example
 * GET /api/facilities/availability?startDate=2025-11-27&endDate=2025-11-28&sessions=[...]&excludeEventId=uuid
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { VenueService } from "@/modules/sems";
import type { DateSessionConfig } from "@/modules/sems";
import { ADMIN_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";

function formatSuccess<T>(data: T, status = 200) {
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

/**
 * GET /api/facilities/availability
 *
 * Check venue availability for the specified dates and sessions.
 *
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - sessions: JSON-encoded DateSessionConfig[] (required)
 * - excludeEventId: Event ID to exclude from conflict check (optional, for edit mode)
 *
 * @returns VenueAvailabilityResponseDto with venues and summary
 */
export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const sessionsJson = searchParams.get("sessions");
  const excludeEventId = searchParams.get("excludeEventId") || undefined;

  // Validate required parameters
  if (!startDate) {
    return formatError(400, "MISSING_START_DATE", "startDate parameter is required.");
  }

  if (!endDate) {
    return formatError(400, "MISSING_END_DATE", "endDate parameter is required.");
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) {
    return formatError(400, "INVALID_START_DATE", "startDate must be in YYYY-MM-DD format.");
  }

  if (!dateRegex.test(endDate)) {
    return formatError(400, "INVALID_END_DATE", "endDate must be in YYYY-MM-DD format.");
  }

  // Validate date range
  if (startDate > endDate) {
    return formatError(400, "INVALID_DATE_RANGE", "startDate cannot be after endDate.");
  }

  // Parse sessions JSON
  let sessions: DateSessionConfig[] = [];
  if (sessionsJson) {
    try {
      sessions = JSON.parse(sessionsJson);
      if (!Array.isArray(sessions)) {
        return formatError(400, "INVALID_SESSIONS", "sessions must be an array.");
      }
    } catch {
      return formatError(400, "INVALID_SESSIONS_JSON", "sessions must be valid JSON.");
    }
  }

  // If no sessions provided, return all venues as available
  // This supports the UI showing venues before session configuration
  if (sessions.length === 0) {
    const venueService = new VenueService(supabase);
    try {
      // Get all operational facilities without conflict checking
      const result = await venueService.checkAvailability({
        startDate,
        endDate,
        sessions: [],
        excludeEventId,
      });

      // Mark all as available when no sessions specified
      const venues = result.venues.map((v) => ({
        ...v,
        status: "available" as const,
        conflicts: [],
      }));

      return formatSuccess({
        venues,
        summary: {
          total: venues.length,
          available: venues.length,
          partial: 0,
          unavailable: 0,
        },
      });
    } catch (error) {
      console.error("[FacilitiesAvailability] Error:", error);
      return formatError(
        500,
        "AVAILABILITY_CHECK_FAILED",
        "Unable to check venue availability.",
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // Check availability with sessions
  try {
    const venueService = new VenueService(supabase);
    const result = await venueService.checkAvailability({
      startDate,
      endDate,
      sessions,
      excludeEventId,
    });

    return formatSuccess(result);
  } catch (error) {
    console.error("[FacilitiesAvailability] Error:", error);
    return formatError(
      500,
      "AVAILABILITY_CHECK_FAILED",
      "Unable to check venue availability.",
      error instanceof Error ? error.message : undefined
    );
  }
}
