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

interface ParentEventChildSessionDto {
  sessionId: string;
  period: SessionPeriod;
  direction: SessionDirection;
  scheduledOpens: string | null;
  scheduledCloses: string | null;
  scannedAt: string | null;
  status: "none" | "present" | "late";
}

interface ParentEventChildDto {
  studentId: string;
  fullName: string;
  gradeLevel: string | null;
  section: string | null;
  sessions: ParentEventChildSessionDto[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, ["PARENT"]);
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();
  const eventRepository = new EventRepository(supabase);
  const eventService = new EventService(eventRepository);
  const options = parseListEventsOptions(new URL(request.url).searchParams);

  try {
    const result = await eventService.listParentEvents(
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

    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select("id, first_name, last_name, section_id")
      .in("id", studentIds);

    if (studentsError) {
      console.error("[GET /api/sems/events/parent] Failed to load students:", studentsError);
      return formatSuccess(result);
    }

    const studentsById = new Map<
      string,
      { id: string; first_name: string | null; last_name: string | null; section_id: string | null }
    >();

    for (const row of studentRows ?? []) {
      studentsById.set(row.id as string, {
        id: row.id as string,
        first_name: (row as any).first_name ?? null,
        last_name: (row as any).last_name ?? null,
        section_id: (row as any).section_id ?? null,
      });
    }

    const sectionIds = Array.from(
      new Set(
        Array.from(studentsById.values())
          .map((row) => row.section_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const sectionsById = new Map<
      string,
      { id: string; name: string; level_id: string | null }
    >();
    const levelsById = new Map<
      string,
      { id: string; name: string }
    >();

    if (sectionIds.length > 0) {
      const { data: sectionRows, error: sectionsError } = await supabase
        .from("sections")
        .select("id, name, level_id")
        .in("id", sectionIds);

      if (sectionsError) {
        console.error("[GET /api/sems/events/parent] Failed to load sections:", sectionsError);
      } else {
        for (const row of sectionRows ?? []) {
          sectionsById.set(row.id as string, {
            id: row.id as string,
            name: (row as any).name ?? "",
            level_id: (row as any).level_id ?? null,
          });
        }

        const levelIds = Array.from(
          new Set(
            (sectionRows ?? [])
              .map((row) => (row as any).level_id as string | null)
              .filter((id): id is string => Boolean(id))
          )
        );

        if (levelIds.length > 0) {
          const { data: levelRows, error: levelsError } = await supabase
            .from("levels")
            .select("id, name")
            .in("id", levelIds);

          if (levelsError) {
            console.error("[GET /api/sems/events/parent] Failed to load levels:", levelsError);
          } else {
            for (const row of levelRows ?? []) {
              levelsById.set(row.id as string, {
                id: row.id as string,
                name: (row as any).name ?? "",
              });
            }
          }
        }
      }
    }

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("event_sessions")
      .select("id, event_id, name, session_type, start_time, end_time")
      .in("event_id", eventIds);

    if (sessionsError) {
      console.error("[GET /api/sems/events/parent] Failed to load sessions:", sessionsError);
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
      student_id: string | null;
      scanned_at: string | null;
      status: string;
    }> = [];

    if (sessionIds.length > 0) {
      const { data: logRows, error: logsError } = await supabase
        .from("attendance_logs")
        .select("event_session_id, student_id, scanned_at, status")
        .in("event_session_id", sessionIds)
        .in("student_id", studentIds);

      if (logsError) {
        console.error("[GET /api/sems/events/parent] Failed to load attendance logs:", logsError);
      } else {
        logs = (logRows ?? []) as Array<{
          event_session_id: string;
          student_id: string | null;
          scanned_at: string | null;
          status: string;
        }>;
      }
    }

    const logsByStudentAndSession = new Map<string, Map<string, { scanned_at: string | null; status: string }>>();

    for (const log of logs) {
      if (!log.student_id) continue;
      const studentId = log.student_id;
      if (!logsByStudentAndSession.has(studentId)) {
        logsByStudentAndSession.set(studentId, new Map());
      }
      const bySession = logsByStudentAndSession.get(studentId)!;
      if (!bySession.has(log.event_session_id)) {
        bySession.set(log.event_session_id, {
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
      console.error("[GET /api/sems/events/parent] Failed to load facilities:", facilitiesError);
    }

    const facilityImageByEventId = new Map<string, string | null>();
    for (const row of facilityRows ?? []) {
      const eventId = row.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const facilities = (row as any).facilities as { image_url?: string | null } | null;
      facilityImageByEventId.set(eventId, facilities?.image_url ?? null);
    }

    const childrenByEventId = new Map<string, ParentEventChildDto[]>();

    for (const eventId of eventIds) {
      const eventSessions = sessionsByEventId.get(eventId) ?? [];
      const children: ParentEventChildDto[] = [];

      for (const studentId of studentIds) {
        const base = studentsById.get(studentId);
        if (!base) continue;

        const section = base.section_id ? sectionsById.get(base.section_id) ?? null : null;
        const level = section?.level_id ? levelsById.get(section.level_id) ?? null : null;

        const firstName = base.first_name;
        const lastName = base.last_name;
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || studentId;

        const bySession = logsByStudentAndSession.get(studentId) ?? new Map();

        const sessions: ParentEventChildSessionDto[] = eventSessions.map((session) => {
          const rawType = (session.session_type ?? "morning_in") as string;
          const [rawPeriod, rawDirection] = rawType.split("_");
          const period: SessionPeriod =
            rawPeriod === "afternoon" || rawPeriod === "evening" ? rawPeriod : "morning";
          const direction: SessionDirection = rawDirection === "out" ? "out" : "in";

          const log = bySession.get(session.id) ?? null;
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
          } as ParentEventChildSessionDto;
        });

        children.push({
          studentId,
          fullName,
          gradeLevel: level?.name ?? null,
          section: section?.name ?? null,
          sessions,
        });
      }

      childrenByEventId.set(eventId, children);
    }

    const enriched = {
      ...result,
      events: events.map((event) => ({
        ...event,
        facilityImageUrl: facilityImageByEventId.get(event.id) ?? null,
        children: childrenByEventId.get(event.id) ?? [],
      })),
    };

    return formatSuccess(enriched);
  } catch (error) {
    console.error("[GET /api/sems/events/parent] Unexpected error:", error);
    return formatError(500, "EVENT_LIST_FAILED", "Unable to load parent events.");
  }
}
