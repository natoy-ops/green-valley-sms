import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { EventRepository } from "@/modules/sems";
import type { EventAudienceConfig, AudienceRule } from "@/modules/sems/domain/types";
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

interface ScannerStudentResource {
  id: string;
  fullName: string;
  lrn: string;
  levelId: string | null;
  levelName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  qrHash: string;
}

interface StudentWithSection {
  id: string;
  student_school_id: string;
  first_name: string;
  last_name: string;
  section_id: string | null;
  qr_hash: string;
  is_active: boolean;
}

/**
 * Filter students based on event's audience configuration.
 * Rules are applied in order:
 * 1. Start with empty set
 * 2. Apply "include" rules to add matching students
 * 3. Apply "exclude" rules to remove matching students
 */
function filterStudentsByAudienceConfig(
  students: StudentWithSection[],
  sectionToLevelMap: Map<string, string>,
  audienceConfig: EventAudienceConfig | null | undefined
): StudentWithSection[] {
  // If no config or no rules, return all students (backwards compatible)
  if (!audienceConfig?.rules || audienceConfig.rules.length === 0) {
    return students;
  }

  const allowedIds = new Set<string>();

  // First pass: apply include rules
  for (const rule of audienceConfig.rules) {
    if (rule.effect !== "include") continue;

    switch (rule.kind) {
      case "ALL_STUDENTS":
        // Include all students
        for (const s of students) {
          allowedIds.add(s.id);
        }
        break;

      case "LEVEL":
        // Include students whose section belongs to one of the specified levels
        if ("levelIds" in rule && Array.isArray(rule.levelIds)) {
          const levelSet = new Set(rule.levelIds);
          for (const s of students) {
            if (s.section_id) {
              const levelId = sectionToLevelMap.get(s.section_id);
              if (levelId && levelSet.has(levelId)) {
                allowedIds.add(s.id);
              }
            }
          }
        }
        break;

      case "SECTION":
        // Include students in specified sections
        if ("sectionIds" in rule && Array.isArray(rule.sectionIds)) {
          const sectionSet = new Set(rule.sectionIds);
          for (const s of students) {
            if (s.section_id && sectionSet.has(s.section_id)) {
              allowedIds.add(s.id);
            }
          }
        }
        break;

      case "STUDENT":
        // Include specific students
        if ("studentIds" in rule && Array.isArray(rule.studentIds)) {
          for (const studentId of rule.studentIds) {
            allowedIds.add(studentId);
          }
        }
        break;
    }
  }

  // Second pass: apply exclude rules
  for (const rule of audienceConfig.rules) {
    if (rule.effect !== "exclude") continue;

    switch (rule.kind) {
      case "ALL_STUDENTS":
        // Exclude all - clear the set
        allowedIds.clear();
        break;

      case "LEVEL":
        if ("levelIds" in rule && Array.isArray(rule.levelIds)) {
          const levelSet = new Set(rule.levelIds);
          for (const s of students) {
            if (s.section_id) {
              const levelId = sectionToLevelMap.get(s.section_id);
              if (levelId && levelSet.has(levelId)) {
                allowedIds.delete(s.id);
              }
            }
          }
        }
        break;

      case "SECTION":
        if ("sectionIds" in rule && Array.isArray(rule.sectionIds)) {
          const sectionSet = new Set(rule.sectionIds);
          for (const s of students) {
            if (s.section_id && sectionSet.has(s.section_id)) {
              allowedIds.delete(s.id);
            }
          }
        }
        break;

      case "STUDENT":
        if ("studentIds" in rule && Array.isArray(rule.studentIds)) {
          for (const studentId of rule.studentIds) {
            allowedIds.delete(studentId);
          }
        }
        break;
    }
  }

  // Return only students whose IDs are in the allowed set
  return students.filter((s) => allowedIds.has(s.id));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_SCANNER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const scannerUserId = authResult.supabaseUser.id;
  const supabase = getAdminSupabaseClient();

  const { id } = await params;

  if (!id) {
    return formatError(400, "MISSING_ID", "Event ID is required.");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return formatError(400, "INVALID_ID", "Invalid event ID format.");
  }

  const eventRepository = new EventRepository(supabase);

  try {
    const event = await eventRepository.findByIdWithFacility(id);

    if (!event) {
      return formatError(404, "NOT_FOUND", "Event not found.");
    }

    const scannerIds = Array.isArray(event.scannerConfig?.scannerIds)
      ? event.scannerConfig.scannerIds
      : [];

    if (scannerIds.length > 0 && !scannerIds.includes(scannerUserId)) {
      return formatError(403, "SCANNER_NOT_ASSIGNED", "You are not assigned to this event.");
    }

    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select("id, student_school_id, first_name, last_name, section_id, qr_hash, is_active")
      .eq("is_active", true);

    if (studentsError || !studentRows) {
      return formatError(
        500,
        "STUDENT_FETCH_FAILED",
        "Failed to fetch students for scanner resources.",
        studentsError ?? undefined
      );
    }

    const students = studentRows as {
      id: string;
      student_school_id: string;
      first_name: string;
      last_name: string;
      section_id: string | null;
      qr_hash: string;
      is_active: boolean;
    }[];

    const sectionIds = Array.from(
      new Set(students.map((s) => s.section_id).filter((id): id is string => !!id))
    );

    const { data: sectionRows, error: sectionsError } = await supabase
      .from("sections")
      .select("id, name, level_id")
      .in("id", sectionIds);

    if (sectionsError) {
      return formatError(
        500,
        "SECTION_LOOKUP_FAILED",
        "Unable to resolve sections for students.",
        sectionsError
      );
    }

    const sections =
      (sectionRows as { id: string; name: string; level_id: string | null }[] | null) ?? [];
    const sectionMap = new Map(sections.map((s) => [s.id, s]));

    const levelIds = Array.from(
      new Set(sections.map((s) => s.level_id).filter((id): id is string => !!id))
    );

    const { data: levelRows, error: levelsError } = await supabase
      .from("levels")
      .select("id, name")
      .in("id", levelIds);

    if (levelsError) {
      return formatError(
        500,
        "LEVEL_LOOKUP_FAILED",
        "Unable to resolve levels for students.",
        levelsError
      );
    }

    const levels = (levelRows as { id: string; name: string }[] | null) ?? [];
    const levelMap = new Map(levels.map((l) => [l.id, l]));

    // Build section -> level mapping for audience filtering
    const sectionToLevelMap = new Map<string, string>();
    for (const section of sections) {
      if (section.level_id) {
        sectionToLevelMap.set(section.id, section.level_id);
      }
    }

    // Filter students based on event's audience config
    const filteredStudents = filterStudentsByAudienceConfig(
      students as StudentWithSection[],
      sectionToLevelMap,
      event.audienceConfig
    );

    const studentResources: ScannerStudentResource[] = filteredStudents.map((student) => {
      const section = student.section_id ? sectionMap.get(student.section_id) ?? null : null;
      const level = section?.level_id ? levelMap.get(section.level_id) ?? null : null;

      return {
        id: student.id,
        fullName: `${student.first_name} ${student.last_name}`.trim(),
        lrn: student.student_school_id,
        levelId: section?.level_id ?? null,
        levelName: level?.name ?? null,
        sectionId: section?.id ?? null,
        sectionName: section?.name ?? null,
        qrHash: student.qr_hash,
      };
    });

    return formatSuccess({
      event: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        facilityName: event.facility?.name ?? null,
        audienceConfig: event.audienceConfig,
        sessionConfig: event.sessionConfig,
      },
      students: studentResources,
    });
  } catch (error) {
    console.error("[GET /api/sems/events/[id]/scanner-resources] Unexpected error:", error);
    return formatError(
      500,
      "SCANNER_RESOURCES_FAILED",
      "Unable to load scanner resources for this event.",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
