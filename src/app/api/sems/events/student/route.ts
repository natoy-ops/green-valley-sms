import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository, EventService } from "@/modules/sems";
import { requireRoles } from "@/core/auth/server-role-guard";
import {
  buildActorContext,
  formatError,
  formatSuccess,
  parseListEventsOptions,
} from "../utils";

type SessionPeriod = "morning" | "afternoon" | "evening";
type SessionDirection = "in" | "out";

interface StudentEventSessionDto {
  sessionId: string;
  period: SessionPeriod;
  direction: SessionDirection;
  scheduledOpens: string | null;
  scheduledCloses: string | null;
  scannedAt: string | null;
  status: "none" | "present" | "late";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, ["STUDENT"]);
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);
  const options = parseListEventsOptions(new URL(request.url).searchParams);

  try {
    const result = await eventService.listStudentEvents(
      buildActorContext(authResult.appUser),
      options
    );
    const events = result.events ?? [];

    if (events.length === 0) {
      return formatSuccess(result);
    }

    const eventIds = events.map((event) => event.id);

    const contexts = await eventRepository.getStudentContextsForUser(authResult.appUser.id);
    const studentIds = Array.from(
      new Set(contexts.map((context) => context.studentId).filter((id): id is string => Boolean(id)))
    );

    if (studentIds.length === 0) {
      return formatSuccess(result);
    }

    const primaryStudentId = studentIds[0];

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("event_sessions")
      .select("id, event_id, name, session_type, start_time, end_time")
      .in("event_id", eventIds);

    if (sessionsError) {
      console.error("[GET /api/sems/events/student] Failed to load sessions:", sessionsError);
      return formatSuccess(result);
    }

    const sessionsByEventId = new Map<
      string,
      Array<{
        id: string;
        event_id: string;
        name: string | null;
        session_type: string | null;
        start_time: string | null;
        end_time: string | null;
      }>
    >();

    const sessionIds: string[] = [];

    for (const row of sessionRows ?? []) {
      const eventId = row.event_id as string;
      if (!sessionsByEventId.has(eventId)) {
        sessionsByEventId.set(eventId, []);
      }
      sessionsByEventId.get(eventId)!.push({
        id: row.id as string,
        event_id: eventId,
        name: (row as any).name ?? null,
        session_type: (row as any).session_type ?? null,
        start_time: (row as any).start_time ?? null,
        end_time: (row as any).end_time ?? null,
      });
      sessionIds.push(row.id as string);
    }

    let logs: Array<{
      event_session_id: string;
      scanned_at: string | null;
      status: string;
    }> = [];

    if (sessionIds.length > 0) {
      const { data: logRows, error: logsError } = await supabase
        .from("attendance_logs")
        .select("event_session_id, scanned_at, status")
        .in("event_session_id", sessionIds)
        .eq("student_id", primaryStudentId);

      if (logsError) {
        console.error("[GET /api/sems/events/student] Failed to load attendance logs:", logsError);
      } else {
        logs = (logRows ?? []) as Array<{
          event_session_id: string;
          scanned_at: string | null;
          status: string;
        }>;
      }
    }

    const logsBySessionId = new Map<string, { scanned_at: string | null; status: string }>();

    for (const log of logs) {
      if (!logsBySessionId.has(log.event_session_id)) {
        logsBySessionId.set(log.event_session_id, {
          scanned_at: log.scanned_at,
          status: log.status,
        });
      }
    }

    const { data: facilityRows, error: facilitiesError } = await supabase
      .from("events")
      .select("id, facilities ( image_url )")
      .in("id", eventIds);

    if (facilitiesError) {
      console.error("[GET /api/sems/events/student] Failed to load facilities:", facilitiesError);
    }

    const facilityImageByEventId = new Map<string, string | null>();
    for (const row of facilityRows ?? []) {
      const eventId = row.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const facilities = (row as any).facilities as { image_url?: string | null } | null;
      facilityImageByEventId.set(eventId, facilities?.image_url ?? null);
    }

    const enriched = {
      ...result,
      events: events.map((event) => {
        const eventSessions = sessionsByEventId.get(event.id) ?? [];

        const mySessions: StudentEventSessionDto[] = eventSessions.map((session) => {
          const rawType = (session.session_type ?? "morning_in") as string;
          const [rawPeriod, rawDirection] = rawType.split("_");
          const period: SessionPeriod =
            rawPeriod === "afternoon" || rawPeriod === "evening" ? rawPeriod : "morning";
          const direction: SessionDirection = rawDirection === "out" ? "out" : "in";

          const log = logsBySessionId.get(session.id) ?? null;
          let status: "none" | "present" | "late" = "none";
          if (log) {
            if (log.status === "late") {
              status = "late";
            } else if (log.status === "present") {
              status = "present";
            }
          }

          return {
            sessionId: session.id,
            period,
            direction,
            scheduledOpens: session.start_time,
            scheduledCloses: session.end_time,
            scannedAt: log?.scanned_at ?? null,
            status,
          } as StudentEventSessionDto;
        });

        return {
          ...event,
          facilityImageUrl: facilityImageByEventId.get(event.id) ?? null,
          mySessions,
        };
      }),
    };

    return formatSuccess(enriched);
  } catch (error) {
    console.error("[GET /api/sems/events/student] Unexpected error:", error);
    return formatError(500, "EVENT_LIST_FAILED", "Unable to load student events.");
  }
}
