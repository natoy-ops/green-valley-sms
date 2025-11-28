import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventService, EventRepository } from "@/modules/sems";
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

export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_SCANNER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const userId = authResult.supabaseUser.id;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));
  const facilityId = searchParams.get("facilityId") ?? undefined;
  const searchTerm = searchParams.get("search") ?? undefined;

  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);

  try {
    const result = await eventService.listScannerEvents(userId, {
      page,
      pageSize,
      facilityId,
      searchTerm,
    });

    return formatSuccess(result);
  } catch (error) {
    console.error("[GET /api/sems/events/scanner] Unexpected error:", error);
    return formatError(
      500,
      "SCANNER_EVENT_LIST_FAILED",
      "Unable to load scanner events.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
