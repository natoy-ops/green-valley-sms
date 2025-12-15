/**
 * SEMS Events API Route Handler
 *
 * POST /api/sems/events - Create a new event
 * GET /api/sems/events - List events (future)
 *
 * @remarks
 * HTTP layer responsibilities:
 * - Authentication/authorization
 * - Request parsing and response formatting
 * - Error handling and status codes
 *
 * Business logic is delegated to EventService.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import {
  EventService,
  EventRepository,
  ValidationError,
  NotFoundError,
  type CreateEventDto,
  type EventAudienceConfig,
  type EventSessionConfig,
  type EventScannerConfig,
  type UpdateEventDto,
  type EventVisibility,
  type WorkflowActorContext,
  type IEventRepository,
} from "@/modules/sems";
import { ADMIN_ROLES, ADMIN_SCANNER_ROLES, ADMIN_TEACHER_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";
import {
  buildActorContext,
  formatError,
  formatSuccess,
  parseListEventsOptions,
} from "./utils";

// ============================================================================
// Request Body Parsing
// ============================================================================

/**
 * Parse and transform raw request body to CreateEventDto.
 *
 * @param body - Raw request body
 * @returns Parsed DTO or null if parsing fails
 *
 * @remarks
 * Frontend sends:
 * - title: string
 * - startDate: string (YYYY-MM-DD)
 * - endDate: string (YYYY-MM-DD)
 * - facilityId: string (optional)
 * - audienceConfigJson: string (JSON)
 * - sessionConfigJson: string (JSON)
 * - scannerConfigJson: string (JSON)
 */
function parseCreateRequestBody(body: unknown): CreateEventDto | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const data = body as Record<string, unknown>;

  // Parse JSON strings from form data
  let audienceConfig: EventAudienceConfig | undefined;
  let sessionConfig: EventSessionConfig | undefined;
  let scannerConfig: EventScannerConfig | undefined;

  try {
    if (typeof data.audienceConfigJson === "string") {
      audienceConfig = JSON.parse(data.audienceConfigJson);
    } else if (data.audienceConfig && typeof data.audienceConfig === "object") {
      audienceConfig = data.audienceConfig as EventAudienceConfig;
    }
  } catch {
    // Will be caught by validation
  }

  try {
    if (typeof data.sessionConfigJson === "string") {
      sessionConfig = JSON.parse(data.sessionConfigJson);
    } else if (data.sessionConfig && typeof data.sessionConfig === "object") {
      sessionConfig = data.sessionConfig as EventSessionConfig;
    }
  } catch {
    // Will be caught by validation
  }

  try {
    if (typeof data.scannerConfigJson === "string") {
      scannerConfig = JSON.parse(data.scannerConfigJson) as EventScannerConfig;
    } else if (data.scannerConfig && typeof data.scannerConfig === "object") {
      scannerConfig = data.scannerConfig as EventScannerConfig;
    }
  } catch {
    // Will be caught by validation
  }

  const visibility =
    typeof data.visibility === "string" ? (data.visibility as EventVisibility) : ("internal" as EventVisibility);

  const registrationRequired =
    typeof data.registrationRequired === "boolean" ? data.registrationRequired : false;

  const registrationOpensAt =
    data.registrationOpensAt === null
      ? null
      : typeof data.registrationOpensAt === "string"
      ? data.registrationOpensAt
      : undefined;

  const registrationClosesAt =
    data.registrationClosesAt === null
      ? null
      : typeof data.registrationClosesAt === "string"
      ? data.registrationClosesAt
      : undefined;

  const capacityLimit =
    data.capacityLimit === null
      ? null
      : typeof data.capacityLimit === "number"
      ? data.capacityLimit
      : typeof data.capacityLimit === "string" && data.capacityLimit.trim() !== ""
      ? Number(data.capacityLimit)
      : undefined;

  return {
    title: typeof data.title === "string" ? data.title : "",
    description:
      typeof data.description === "string" ? data.description : undefined,
    posterImageUrl:
      typeof data.posterImageUrl === "string" ? data.posterImageUrl : undefined,
    startDate: typeof data.startDate === "string" ? data.startDate : "",
    endDate: typeof data.endDate === "string" ? data.endDate : "",
    facilityId:
      typeof data.facilityId === "string" && data.facilityId
        ? data.facilityId
        : undefined,
    audienceConfig: audienceConfig ?? { version: 1, rules: [] },
    sessionConfig: sessionConfig ?? { version: 2, dates: [] },
    scannerConfig: scannerConfig ?? { version: 1, scannerIds: [] },
    visibility,
    registrationRequired,
    registrationOpensAt,
    registrationClosesAt,
    capacityLimit,
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/sems/events
 *
 * Create a new event.
 *
 * @param request - Next.js request object
 * @returns Created event or error response
 *
 * @remarks
 * Request body (JSON):
 * ```json
 * {
 *   "title": "Foundation Day",
 *   "description": "Annual celebration",
 *   "startDate": "2025-03-15",
 *   "endDate": "2025-03-15",
 *   "facilityId": "uuid",
 *   "audienceConfigJson": "{\"version\":1,\"rules\":[...]}",
 *   "sessionConfigJson": "{\"version\":2,\"dates\":[...]}",
 *   "scannerConfigJson": "{\"version\":1,\"scannerIds\":[...]}"
 * }
 * ```
 *
 * Response (201 Created):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "event": { ... }
 *   },
 *   "meta": { "timestamp": "..." }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_TEACHER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const { appUser } = authResult;

  // Step 2: Parse request body
  const body = await request.json().catch(() => null);
  const dto = parseCreateRequestBody(body);

  if (!dto) {
    return formatError(400, "INVALID_REQUEST", "Request body is required.");
  }

  // Step 3: Create service with repository dependency
  const supabase = getAdminSupabaseClient();
  const eventRepository: IEventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);

  // Step 4: Create event via service
  try {
    const event = await eventService.createEvent(dto, buildActorContext(appUser));
    return formatSuccess({ event }, 201);
  } catch (error) {
    // Handle domain-specific errors
    if (error instanceof ValidationError) {
      return formatError(
        400,
        "VALIDATION_ERROR",
        error.message,
        error.details
      );
    }

    if (error instanceof NotFoundError) {
      return formatError(
        404,
        "NOT_FOUND",
        error.message,
        { resource: error.resource, id: error.id }
      );
    }

    // Unexpected error
    console.error("[POST /api/sems/events] Unexpected error:", error);
    return formatError(
      500,
      "EVENT_CREATE_FAILED",
      "Unable to create event.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * GET /api/sems/events
 *
 * List events with pagination and filtering.
 *
 * @param request - Next.js request object
 * @returns List of events with UI-ready data
 *
 * @remarks
 * Query parameters:
 * - page: Page number (default 1)
 * - pageSize: Items per page (default 20, max 100)
 * - facilityId: Filter by venue/facility UUID
 * - search: Search by event title
 *
 * Response includes computed fields:
 * - timeRange: Formatted time range from session config
 * - audienceSummary: Human-readable audience description
 * - actualAttendees / expectedAttendees: Attendance counts
 * - status: live, scheduled, or completed
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_TEACHER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  // Create service with repository dependency
  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);

  try {
    const options = parseListEventsOptions(new URL(request.url).searchParams);
    const result = await eventService.listEvents(options);

    return formatSuccess(result);
  } catch (error) {
    console.error("[GET /api/sems/events] Unexpected error:", error);
    return formatError(
      500,
      "EVENT_LIST_FAILED",
      "Unable to load events.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * PUT /api/sems/events
 *
 * Update an existing event.
 *
 * @param request - Next.js request object
 * @returns Updated event or error response
 *
 * @remarks
 * Request body (JSON):
 * ```json
 * {
 *   "id": "uuid",
 *   "title": "Updated Title",
 *   "startDate": "2025-03-15",
 *   "endDate": "2025-03-16",
 *   "facilityId": "uuid",
 *   "audienceConfigJson": "{\"version\":1,\"rules\":[...]}",
 *   "sessionConfigJson": "{\"version\":2,\"dates\":[...]}"
 * }
 * ```
 *
 * Response (200 OK):
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "event": { ... }
 *   },
 *   "meta": { "timestamp": "..." }
 * }
 * ```
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_TEACHER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const { appUser } = authResult;

  // Step 2: Parse request body
  const body = await request.json().catch(() => null);
  
  if (!body || typeof body !== "object") {
    return formatError(400, "INVALID_REQUEST", "Request body is required.");
  }

  const data = body as Record<string, unknown>;

  // Parse JSON strings from form data (same as POST)
  let audienceConfig: EventAudienceConfig | undefined;
  let sessionConfig: EventSessionConfig | undefined;
  let scannerConfig: EventScannerConfig | undefined;

  try {
    if (typeof data.audienceConfigJson === "string") {
      audienceConfig = JSON.parse(data.audienceConfigJson) as EventAudienceConfig;
    } else if (data.audienceConfig && typeof data.audienceConfig === "object") {
      audienceConfig = data.audienceConfig as EventAudienceConfig;
    }
  } catch {
    // Will be caught by validation
  }

  try {
    if (typeof data.sessionConfigJson === "string") {
      sessionConfig = JSON.parse(data.sessionConfigJson) as EventSessionConfig;
    } else if (data.sessionConfig && typeof data.sessionConfig === "object") {
      sessionConfig = data.sessionConfig as EventSessionConfig;
    }
  } catch {
    // Will be caught by validation
  }

  try {
    if (typeof data.scannerConfigJson === "string") {
      scannerConfig = JSON.parse(data.scannerConfigJson) as EventScannerConfig;
    } else if (data.scannerConfig && typeof data.scannerConfig === "object") {
      scannerConfig = data.scannerConfig as EventScannerConfig;
    }
  } catch {
    // Will be caught by validation
  }

  const dto: UpdateEventDto = {
    id: typeof data.id === "string" ? data.id : "",
    title: typeof data.title === "string" ? data.title : undefined,
    description:
      typeof data.description === "string" ? data.description : undefined,
    posterImageUrl:
      data.posterImageUrl === null
        ? null
        : typeof data.posterImageUrl === "string"
        ? data.posterImageUrl
        : undefined,
    startDate:
      typeof data.startDate === "string" ? data.startDate : undefined,
    endDate: typeof data.endDate === "string" ? data.endDate : undefined,
    facilityId:
      data.facilityId === null
        ? null
        : typeof data.facilityId === "string"
        ? data.facilityId
        : undefined,
    audienceConfig,
    sessionConfig,
    scannerConfig,
    visibility:
      typeof data.visibility === "string" ? (data.visibility as EventVisibility) : undefined,
    registrationRequired:
      typeof data.registrationRequired === "boolean" ? data.registrationRequired : undefined,
    registrationOpensAt:
      data.registrationOpensAt === null
        ? null
        : typeof data.registrationOpensAt === "string"
        ? data.registrationOpensAt
        : undefined,
    registrationClosesAt:
      data.registrationClosesAt === null
        ? null
        : typeof data.registrationClosesAt === "string"
        ? data.registrationClosesAt
        : undefined,
    capacityLimit:
      data.capacityLimit === null
        ? null
        : typeof data.capacityLimit === "number"
        ? data.capacityLimit
        : typeof data.capacityLimit === "string" && data.capacityLimit.trim() !== ""
        ? Number(data.capacityLimit)
        : undefined,
    workflowAction:
      typeof data.workflowAction === "string" ? (data.workflowAction as UpdateEventDto["workflowAction"]) : undefined,
    workflowComment:
      data.workflowComment === null
        ? null
        : typeof data.workflowComment === "string"
        ? data.workflowComment
        : undefined,
    actionReason:
      data.actionReason === null
        ? null
        : typeof data.actionReason === "string"
        ? data.actionReason
        : undefined,
  };

  // Step 3: Create service with repository dependency
  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);

  // Step 4: Update event via service
  try {
    const event = await eventService.updateEvent(dto, buildActorContext(appUser));
    return formatSuccess({ event }, 200);
  } catch (error) {
    // Handle domain-specific errors
    if (error instanceof ValidationError) {
      return formatError(
        400,
        "VALIDATION_ERROR",
        error.message,
        error.details
      );
    }

    if (error instanceof NotFoundError) {
      return formatError(
        404,
        "NOT_FOUND",
        error.message,
        { resource: error.resource, id: error.id }
      );
    }

    // Unexpected error
    console.error("[PUT /api/sems/events] Unexpected error:", error);
    return formatError(
      500,
      "EVENT_UPDATE_FAILED",
      "Unable to update event.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * DELETE /api/sems/events
 *
 * Bulk delete events by ID.
 *
 * Request body (JSON):
 * { "ids": ["uuid1", "uuid2", ...] }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  // Parse request body
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return formatError(400, "INVALID_REQUEST", "Request body is required.");
  }

  const data = body as { ids?: unknown };
  const ids = Array.isArray(data.ids) ? data.ids : [];

  // Create service with repository dependency
  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);

  try {
    const deletedCount = await eventService.deleteEvents(ids as string[]);
    return formatSuccess({ deletedCount });
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatError(
        400,
        "VALIDATION_ERROR",
        error.message,
        error.details
      );
    }

    console.error("[DELETE /api/sems/events] Unexpected error:", error);
    return formatError(
      500,
      "EVENT_DELETE_FAILED",
      "Unable to delete events.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
