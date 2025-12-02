/**
 * API Route: /api/sems/events/[id]
 *
 * Handles single event operations by ID.
 *
 * @remarks
 * - GET: Fetch event details for editing
 * - Uses service/repository pattern
 * - Returns full EventDto with facility data
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository, EventService } from "@/modules/sems";
import { ADMIN_TEACHER_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";

// ============================================================================
// Response Helpers
// ============================================================================

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

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/sems/events/[id]
 *
 * Fetch a single event by ID with full details for editing.
 *
 * @param request - Next.js request object
 * @param context - Route context containing params
 * @returns Event data or error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_TEACHER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  // Get event ID from params
  const { id } = await params;

  if (!id) {
    return formatError(400, "MISSING_ID", "Event ID is required.");
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return formatError(400, "INVALID_ID", "Invalid event ID format.");
  }

  // Create repository and fetch event
  const eventRepository = new EventRepository(supabase);

  try {
    const event = await eventRepository.findByIdWithFacility(id);

    if (!event) {
      return formatError(404, "NOT_FOUND", "Event not found.");
    }

    return formatSuccess({ event });
  } catch (error) {
    console.error("[GET /api/sems/events/[id]] Unexpected error:", error);
    return formatError(
      500,
      "EVENT_FETCH_FAILED",
      "Unable to load event.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
