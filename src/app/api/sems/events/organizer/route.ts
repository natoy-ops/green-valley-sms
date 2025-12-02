import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository, EventService } from "@/modules/sems";
import { requireRoles } from "@/core/auth/server-role-guard";
import type { UserRole } from "@/core/auth/types";
import {
  buildActorContext,
  formatError,
  formatSuccess,
  parseListEventsOptions,
} from "../utils";

const ORGANIZER_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "TEACHER", "STAFF"];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, ORGANIZER_ROLES);
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);
  const options = parseListEventsOptions(new URL(request.url).searchParams);

  try {
    const result = await eventService.listOrganizerEvents(
      buildActorContext(authResult.appUser),
      options
    );
    return formatSuccess(result);
  } catch (error) {
    console.error("[GET /api/sems/events/organizer] Unexpected error:", error);
    return formatError(500, "EVENT_LIST_FAILED", "Unable to load organizer events.");
  }
}
