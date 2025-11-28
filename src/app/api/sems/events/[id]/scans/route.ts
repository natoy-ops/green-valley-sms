import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository } from "@/modules/sems";
import { ADMIN_SCANNER_ROLES } from "@/config/roles";
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
 * Maps period + direction to database session_type enum.
 */
function toDbSessionType(
  period: string | null,
  direction: string | null
): string {
  const p = (period ?? "morning").toLowerCase();
  const d = (direction ?? "in").toLowerCase();
  return `${p}_${d}`;
}

/**
 * Scan record received from frontend IndexedDB.
 */
interface ScanUploadRecord {
  id: string;
  studentId: string;
  qrHash: string;
  scannedAt: string;
  status: "PRESENT" | "LATE" | "DENIED" | "DUPLICATE";
  reason: string | null;
  sessionId: string | null;
  sessionName: string | null;
  sessionDirection: "in" | "out" | null;
  sessionPeriod?: string | null;
  sessionOpens?: string | null;
  sessionCloses?: string | null;
  sessionLateAfter?: string | null;
}

interface UploadScansBody {
  scans: ScanUploadRecord[];
}

/**
 * POST /api/sems/events/[id]/scans
 *
 * Uploads offline scan records to the database.
 * Creates event_sessions if they don't exist, then inserts attendance_logs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_SCANNER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const syncedByUserId = authResult.supabaseUser.id;
  const { id: eventId } = await params;

  if (!eventId) {
    return formatError(400, "MISSING_ID", "Event ID is required.");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(eventId)) {
    return formatError(400, "INVALID_ID", "Invalid event ID format.");
  }

  // Parse request body
  let body: UploadScansBody;
  try {
    body = await request.json();
  } catch {
    return formatError(400, "INVALID_BODY", "Request body must be valid JSON.");
  }

  if (!body.scans || !Array.isArray(body.scans)) {
    return formatError(400, "INVALID_SCANS", "Request body must contain a 'scans' array.");
  }

  // Filter to only valid scans (PRESENT or LATE, with studentId and sessionId)
  const validScans = body.scans.filter(
    (scan) =>
      (scan.status === "PRESENT" || scan.status === "LATE") &&
      scan.studentId &&
      scan.sessionId
  );

  if (validScans.length === 0) {
    return formatSuccess({
      uploaded: 0,
      skipped: body.scans.length,
      duplicates: 0,
      errors: 0,
      message: "No valid scans to upload.",
    });
  }

  // Verify event exists and user is authorized
  const eventRepository = new EventRepository(supabase);
  
  try {
    const event = await eventRepository.findByIdWithFacility(eventId);

    if (!event) {
      return formatError(404, "NOT_FOUND", "Event not found.");
    }

    // Check if user is a scanner for this event
    const scannerIds = Array.isArray(event.scannerConfig?.scannerIds)
      ? event.scannerConfig.scannerIds
      : [];

    if (scannerIds.length > 0 && !scannerIds.includes(syncedByUserId)) {
      return formatError(403, "SCANNER_NOT_ASSIGNED", "You are not assigned to scan for this event.");
    }

    // Group scans by sessionId to batch create event_sessions
    const scansBySession = new Map<string, ScanUploadRecord[]>();
    for (const scan of validScans) {
      const sessionId = scan.sessionId!;
      if (!scansBySession.has(sessionId)) {
        scansBySession.set(sessionId, []);
      }
      scansBySession.get(sessionId)!.push(scan);
    }

    // Find or create event_sessions and build mapping
    const sessionIdToDbId = new Map<string, string>();
    
    for (const [configSessionId, scans] of scansBySession) {
      const firstScan = scans[0];
      const sessionType = toDbSessionType(
        firstScan.sessionPeriod ?? "morning",
        firstScan.sessionDirection
      );

      // Check if event_session already exists for this event with matching name
      const { data: existingSessions } = await supabase
        .from("event_sessions")
        .select("id, name")
        .eq("event_id", eventId)
        .eq("name", firstScan.sessionName ?? configSessionId)
        .limit(1);

      let dbSessionId: string;

      if (existingSessions && existingSessions.length > 0) {
        dbSessionId = existingSessions[0].id;
      } else {
        // Create new event_session
        // Parse times from session config or use defaults
        const opensTime = firstScan.sessionOpens ?? "07:00";
        const closesTime = firstScan.sessionCloses ?? "08:00";
        const lateAfterTime = firstScan.sessionLateAfter ?? null;

        const { data: newSession, error: createError } = await supabase
          .from("event_sessions")
          .insert({
            event_id: eventId,
            name: firstScan.sessionName ?? configSessionId,
            session_type: sessionType,
            start_time: opensTime,
            late_threshold_time: lateAfterTime,
            end_time: closesTime,
          })
          .select("id")
          .single();

        if (createError || !newSession) {
          console.error("[POST /api/sems/events/[id]/scans] Failed to create event_session:", createError);
          // Try to continue with other sessions
          continue;
        }

        dbSessionId = newSession.id;
      }

      sessionIdToDbId.set(configSessionId, dbSessionId);
    }

    // Insert attendance_logs
    let uploaded = 0;
    let duplicates = 0;
    let errors = 0;
    const uploadedScanIds: string[] = [];

    for (const scan of validScans) {
      const dbSessionId = sessionIdToDbId.get(scan.sessionId!);
      if (!dbSessionId) {
        errors++;
        continue;
      }

      // Map status to database enum
      const dbStatus = scan.status === "PRESENT" ? "present" : "late";

      const { error: insertError } = await supabase.from("attendance_logs").insert({
        event_session_id: dbSessionId,
        student_id: scan.studentId,
        scanned_at: scan.scannedAt,
        status: dbStatus,
        scanned_by_device_id: null,
        synced_by_user_id: syncedByUserId,
      });

      if (insertError) {
        // Check if it's a duplicate constraint violation
        if (insertError.code === "23505") {
          duplicates++;
        } else {
          console.error("[POST /api/sems/events/[id]/scans] Insert error:", insertError);
          errors++;
        }
      } else {
        uploaded++;
        uploadedScanIds.push(scan.id);
      }
    }

    return formatSuccess({
      uploaded,
      skipped: body.scans.length - validScans.length,
      duplicates,
      errors,
      uploadedScanIds,
      message: `Successfully uploaded ${uploaded} scan(s).`,
    });
  } catch (error) {
    console.error("[POST /api/sems/events/[id]/scans] Unexpected error:", error);
    return formatError(
      500,
      "UPLOAD_FAILED",
      "Failed to upload scan records.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
