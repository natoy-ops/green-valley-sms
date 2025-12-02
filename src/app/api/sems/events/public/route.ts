import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository, EventService } from "@/modules/sems";
import { formatError, formatSuccess, parseListEventsOptions } from "../utils";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);
  const options = parseListEventsOptions(new URL(request.url).searchParams);

  try {
    const result = await eventService.listPublicEvents(options);
    return formatSuccess(result);
  } catch (error) {
    console.error("[GET /api/sems/events/public] Unexpected error:", error);
    return formatError(500, "EVENT_LIST_FAILED", "Unable to load public events.");
  }
}
