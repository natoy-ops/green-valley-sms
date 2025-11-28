import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository } from "@/modules/sems";
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

type SessionPeriod = "morning" | "afternoon" | "evening";
type SessionDirection = "in" | "out";

type StudentSessionStatus = "none" | "present" | "late" | "no_scan";

interface SessionStatsDto {
  sessionId: string;
  name: string;
  sessionType: string;
  period: SessionPeriod;
  direction: SessionDirection;
  totalScans: number;
  present: number;
  late: number;
  absent: number;
  uniqueStudents: number;
}

interface PeriodStatsDto {
  period: SessionPeriod;
  inSession?: SessionStatsDto;
  outSession?: SessionStatsDto;
  missingOutCount?: number;
}

interface StudentAttendanceRowDto {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  gradeLevel: string | null;
  section: string | null;
  sessions: Record<string, StudentSessionStatus>;
}

interface EventAttendanceStatsDto {
  eventId: string;
  eventTitle: string;
  totalSessions: number;
  totalScans: number;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  uniqueStudents: number;
  periods: PeriodStatsDto[];
  students: StudentAttendanceRowDto[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const { id: eventId } = await params;

  if (!eventId) {
    return formatError(400, "MISSING_ID", "Event ID is required.");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(eventId)) {
    return formatError(400, "INVALID_ID", "Invalid event ID format.");
  }

  try {
    const eventRepository = new EventRepository(supabase);
    const event = await eventRepository.findByIdWithFacility(eventId);

    if (!event) {
      return formatError(404, "NOT_FOUND", "Event not found.");
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from("event_sessions")
      .select("id, name, session_type")
      .eq("event_id", eventId);

    if (sessionsError) {
      return formatError(500, "SESSIONS_FETCH_FAILED", "Unable to load event sessions.", sessionsError);
    }

    const sessionRows = sessions ?? [];
    const sessionIds = sessionRows.map((s) => s.id as string);

    let logs: Array<{ event_session_id: string; status: string; student_id: string | null }> = [];

    if (sessionIds.length > 0) {
      const { data: logRows, error: logsError } = await supabase
        .from("attendance_logs")
        .select("event_session_id, status, student_id")
        .in("event_session_id", sessionIds);

      if (logsError) {
        return formatError(500, "LOGS_FETCH_FAILED", "Unable to load attendance logs.", logsError);
      }

      logs = (logRows ?? []) as Array<{
        event_session_id: string;
        status: string;
        student_id: string | null;
      }>;
    }

    const sessionStatsById = new Map<string, SessionStatsDto>();

    for (const session of sessionRows) {
      const rawType = (session.session_type ?? "morning_in") as string;
      const [rawPeriod, rawDirection] = rawType.split("_");
      const period: SessionPeriod =
        rawPeriod === "afternoon" || rawPeriod === "evening" ? rawPeriod : "morning";
      const direction: SessionDirection = rawDirection === "out" ? "out" : "in";

      const sessionLogs = logs.filter((log) => log.event_session_id === session.id);
      const present = sessionLogs.filter((log) => log.status === "present").length;
      const late = sessionLogs.filter((log) => log.status === "late").length;
      const absent = sessionLogs.filter((log) => log.status === "absent").length;
      const uniqueStudents = new Set(
        sessionLogs.map((log) => log.student_id).filter((id): id is string => Boolean(id))
      ).size;

      const stats: SessionStatsDto = {
        sessionId: session.id,
        name: session.name,
        sessionType: rawType,
        period,
        direction,
        totalScans: sessionLogs.length,
        present,
        late,
        absent,
        uniqueStudents,
      };

      sessionStatsById.set(session.id, stats);
    }

    const sessionsByType = new Map<string, SessionStatsDto>();
    for (const stats of sessionStatsById.values()) {
      sessionsByType.set(stats.sessionType, stats);
    }

    const periods: PeriodStatsDto[] = [];
    const allPeriods: SessionPeriod[] = ["morning", "afternoon", "evening"];

    for (const period of allPeriods) {
      const inSession = sessionsByType.get(`${period}_in`);
      const outSession = sessionsByType.get(`${period}_out`);

      if (!inSession && !outSession) {
        continue;
      }

      let missingOutCount: number | undefined;

      if (inSession && outSession) {
        const inStudents = new Set(
          logs
            .filter((log) => log.event_session_id === inSession.sessionId)
            .map((log) => log.student_id)
            .filter((id): id is string => Boolean(id))
        );

        const outStudents = new Set(
          logs
            .filter((log) => log.event_session_id === outSession.sessionId)
            .map((log) => log.student_id)
            .filter((id): id is string => Boolean(id))
        );

        let missing = 0;
        inStudents.forEach((id) => {
          if (!outStudents.has(id)) {
            missing += 1;
          }
        });

        missingOutCount = missing;
      }

      periods.push({
        period,
        inSession,
        outSession,
        missingOutCount,
      });
    }

    const totalPresent = logs.filter((log) => log.status === "present").length;
    const totalLate = logs.filter((log) => log.status === "late").length;
    const totalAbsent = logs.filter((log) => log.status === "absent").length;

    const studentIds = Array.from(
      new Set(logs.map((log) => log.student_id).filter((id): id is string => Boolean(id)))
    );

    const uniqueStudents = studentIds.length;

    let students: StudentAttendanceRowDto[] = [];

    if (studentIds.length > 0) {
      const { data: studentRows, error: studentsError } = await supabase
        .from("students")
        .select("id, first_name, last_name, section_id")
        .in("id", studentIds);

      if (studentsError) {
        return formatError(
          500,
          "STUDENTS_FETCH_FAILED",
          "Unable to load students for attendance stats.",
          studentsError
        );
      }

      const byId = new Map<string, {
        id: string;
        first_name: string | null;
        last_name: string | null;
        section_id: string | null;
      }>();

      for (const row of studentRows ?? []) {
        byId.set(row.id as string, {
          id: row.id as string,
          first_name: (row as any).first_name ?? null,
          last_name: (row as any).last_name ?? null,
          section_id: (row as any).section_id ?? null,
        });
      }

      const sectionIds = Array.from(
        new Set(
          Array.from(byId.values())
            .map((row) => row.section_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const sectionsById = new Map<
        string,
        {
          id: string;
          name: string;
          level_id: string | null;
        }
      >();

      const levelsById = new Map<
        string,
        {
          id: string;
          name: string;
        }
      >();

      if (sectionIds.length > 0) {
        const { data: sectionRows, error: sectionsError } = await supabase
          .from("sections")
          .select("id, name, level_id")
          .in("id", sectionIds);

        if (sectionsError) {
          return formatError(
            500,
            "SECTIONS_FETCH_FAILED",
            "Unable to load sections for attendance stats.",
            sectionsError
          );
        }

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
            return formatError(
              500,
              "LEVELS_FETCH_FAILED",
              "Unable to load levels for attendance stats.",
              levelsError
            );
          }

          for (const row of levelRows ?? []) {
            levelsById.set(row.id as string, {
              id: row.id as string,
              name: (row as any).name ?? "",
            });
          }
        }
      }

      const logsByStudent = new Map<string, Array<{ event_session_id: string; status: string }>>();
      for (const log of logs) {
        if (!log.student_id) continue;
        const id = log.student_id;
        if (!logsByStudent.has(id)) {
          logsByStudent.set(id, []);
        }
        logsByStudent.get(id)!.push({
          event_session_id: log.event_session_id,
          status: log.status,
        });
      }

      const sessionsForMatrix = Array.from(sessionStatsById.values());

      students = studentIds.map((studentId) => {
        const base = byId.get(studentId) ?? {
          id: studentId,
          first_name: null,
          last_name: null,
          section_id: null,
        };

        const studentLogs = logsByStudent.get(studentId) ?? [];

        const sessions: Record<string, StudentSessionStatus> = {};

        for (const session of sessionsForMatrix) {
          const log = studentLogs.find((l) => l.event_session_id === session.sessionId);
          let status: StudentSessionStatus = "none";

          if (log) {
            if (log.status === "present") {
              status = "present";
            } else if (log.status === "late") {
              status = "late";
            }
          } else if (session.direction === "out") {
            const inSessionType = `${session.period}_in`;
            const inSession = sessionsForMatrix.find(
              (s) => s.sessionType === inSessionType
            );
            if (inSession) {
              const hasInLog = studentLogs.some(
                (l) => l.event_session_id === inSession.sessionId
              );
              if (hasInLog) {
                status = "no_scan";
              }
            }
          }

          sessions[session.sessionId] = status;
        }

        const firstName = base.first_name;
        const lastName = base.last_name;
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || studentId;

        const section = base.section_id ? sectionsById.get(base.section_id) ?? null : null;
        const level = section?.level_id ? levelsById.get(section.level_id) ?? null : null;

        return {
          studentId,
          firstName,
          lastName,
          fullName,
          gradeLevel: level?.name ?? null,
          section: section?.name ?? null,
          sessions,
        };
      });
    }

    const stats: EventAttendanceStatsDto = {
      eventId,
      eventTitle: event.title,
      totalSessions: sessionStatsById.size,
      totalScans: logs.length,
      totalPresent,
      totalLate,
      totalAbsent,
      uniqueStudents,
      periods,
      students,
    };

    return formatSuccess({ stats });
  } catch (error) {
    return formatError(
      500,
      "EVENT_STATS_FAILED",
      "Unable to load event attendance stats.",
      error instanceof Error ? error.message : error
    );
  }
}
