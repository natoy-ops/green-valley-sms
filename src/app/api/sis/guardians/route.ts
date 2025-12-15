import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
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

interface AppUserRow {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  primary_role: string;
  is_active: boolean;
  created_at: string;
}

interface StudentGuardianRow {
  student_id: string;
  app_user_id: string;
  relationship: string | null;
  is_primary: boolean;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_school_id: string;
  section_id: string | null;
}

interface SectionRow {
  id: string;
  name: string;
  level_id: string | null;
}

interface LevelRow {
  id: string;
  name: string;
}

interface GuardianDto {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  linkedStudents: {
    studentId: string;
    studentName: string;
    lrn: string;
    grade: string;
    section: string;
    relationship: string | null;
    isPrimary: boolean;
  }[];
}

export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, [...ADMIN_ROLES]);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const supabase = getAdminSupabaseClient();

  // Get all users with 'parent' or 'PARENT' role
  const { data: appUsers, error: usersError } = await supabase
    .from("app_users")
    .select("id, email, full_name, roles, primary_role, is_active, created_at")
    .or("roles.cs.{parent},roles.cs.{PARENT},primary_role.eq.parent,primary_role.eq.PARENT")
    .order("full_name", { ascending: true });

  if (usersError) {
    console.error("[GET /api/sis/guardians] Failed to fetch app_users", usersError);
    return formatError(500, "DATABASE_ERROR", "Failed to load guardians.");
  }

  if (!appUsers || appUsers.length === 0) {
    return formatSuccess({ guardians: [] });
  }

  const userIds = appUsers.map((u) => u.id);

  // Get all student-guardian links for these users
  const { data: links, error: linksError } = await supabase
    .from("student_guardians")
    .select("student_id, app_user_id, relationship, is_primary")
    .in("app_user_id", userIds);

  if (linksError) {
    console.error("[GET /api/sis/guardians] Failed to fetch student_guardians", linksError);
    return formatError(500, "DATABASE_ERROR", "Failed to load guardian links.");
  }

  // Get student info for linked students
  const studentIds = [...new Set((links ?? []).map((l) => l.student_id))];
  let studentsMap = new Map<string, StudentRow>();
  let sectionsMap = new Map<string, SectionRow>();
  let levelsMap = new Map<string, LevelRow>();

  if (studentIds.length > 0) {
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, first_name, last_name, student_school_id, section_id")
      .in("id", studentIds);

    if (studentsError) {
      console.error("[GET /api/sis/guardians] Failed to fetch students", studentsError);
      return formatError(500, "DATABASE_ERROR", "Failed to load student info.");
    }

    studentsMap = new Map((students ?? []).map((s) => [s.id, s]));

    // Get sections for these students
    const sectionIds = [...new Set((students ?? []).map((s) => s.section_id).filter(Boolean))] as string[];
    if (sectionIds.length > 0) {
      const { data: sections } = await supabase
        .from("sections")
        .select("id, name, level_id")
        .in("id", sectionIds);

      sectionsMap = new Map((sections ?? []).map((s) => [s.id, s]));

      // Get levels for these sections
      const levelIds = [...new Set((sections ?? []).map((s) => s.level_id).filter(Boolean))] as string[];
      if (levelIds.length > 0) {
        const { data: levels } = await supabase
          .from("levels")
          .select("id, name")
          .in("id", levelIds);

        levelsMap = new Map((levels ?? []).map((l) => [l.id, l]));
      }
    }
  }

  // Build guardian DTOs
  const guardians: GuardianDto[] = (appUsers as AppUserRow[]).map((user) => {
    const userLinks = (links ?? []).filter((l) => l.app_user_id === user.id) as StudentGuardianRow[];
    const linkedStudents = userLinks.map((link) => {
      const student = studentsMap.get(link.student_id);
      const section = student?.section_id ? sectionsMap.get(student.section_id) : null;
      const level = section?.level_id ? levelsMap.get(section.level_id) : null;
      return {
        studentId: link.student_id,
        studentName: student ? `${student.first_name} ${student.last_name}`.trim() : "Unknown",
        lrn: student?.student_school_id ?? "",
        grade: level?.name ?? "Unassigned",
        section: section?.name ?? "Unassigned",
        relationship: link.relationship,
        isPrimary: link.is_primary,
      };
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isActive: user.is_active,
      linkedStudents,
    };
  });

  return formatSuccess({ guardians });
}

interface UpdateGuardianBody {
  id?: string;
  fullName?: string;
  email?: string;
  isActive?: boolean;
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireRoles(request, [...ADMIN_ROLES]);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = (await request.json().catch(() => null)) as UpdateGuardianBody | null;

  if (!body || typeof body.id !== "string" || !body.id.trim()) {
    return formatError(400, "VALIDATION_ERROR", "Guardian ID is required.");
  }

  const id = body.id.trim();
  const updates: Record<string, unknown> = {};

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    updates.full_name = body.fullName.trim();
  }

  if (typeof body.email === "string" && body.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return formatError(400, "VALIDATION_ERROR", "Invalid email format.");
    }
    updates.email = body.email.trim().toLowerCase();
  }

  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return formatError(400, "VALIDATION_ERROR", "No valid fields to update.");
  }

  updates.updated_at = new Date().toISOString();

  const supabase = getAdminSupabaseClient();

  const { data: updated, error: updateError } = await supabase
    .from("app_users")
    .update(updates)
    .eq("id", id)
    .select("id, email, full_name, roles, primary_role, is_active, created_at")
    .single();

  if (updateError) {
    console.error("[PATCH /api/sis/guardians] Failed to update guardian", updateError);
    if (updateError.code === "23505") {
      return formatError(409, "DUPLICATE_EMAIL", "This email is already in use.");
    }
    return formatError(500, "DATABASE_ERROR", "Failed to update guardian.");
  }

  // Get linked students for the updated guardian
  const { data: links } = await supabase
    .from("student_guardians")
    .select("student_id, app_user_id, relationship, is_primary")
    .eq("app_user_id", id);

  const studentIds = (links ?? []).map((l) => l.student_id);
  let linkedStudents: GuardianDto["linkedStudents"] = [];

  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, student_school_id, section_id")
      .in("id", studentIds);

    const studentsMap = new Map((students ?? []).map((s) => [s.id, s as StudentRow]));

    // Get sections
    const sectionIds = [...new Set((students ?? []).map((s) => s.section_id).filter(Boolean))] as string[];
    let sectionsMap = new Map<string, SectionRow>();
    let levelsMap = new Map<string, LevelRow>();

    if (sectionIds.length > 0) {
      const { data: sections } = await supabase
        .from("sections")
        .select("id, name, level_id")
        .in("id", sectionIds);

      sectionsMap = new Map((sections ?? []).map((s) => [s.id, s]));

      const levelIds = [...new Set((sections ?? []).map((s) => s.level_id).filter(Boolean))] as string[];
      if (levelIds.length > 0) {
        const { data: levels } = await supabase
          .from("levels")
          .select("id, name")
          .in("id", levelIds);

        levelsMap = new Map((levels ?? []).map((l) => [l.id, l]));
      }
    }

    linkedStudents = (links ?? []).map((link) => {
      const student = studentsMap.get(link.student_id);
      const section = student?.section_id ? sectionsMap.get(student.section_id) : null;
      const level = section?.level_id ? levelsMap.get(section.level_id) : null;
      return {
        studentId: link.student_id,
        studentName: student ? `${student.first_name} ${student.last_name}`.trim() : "Unknown",
        lrn: student?.student_school_id ?? "",
        grade: level?.name ?? "Unassigned",
        section: section?.name ?? "Unassigned",
        relationship: link.relationship,
        isPrimary: link.is_primary,
      };
    });
  }

  const guardian: GuardianDto = {
    id: updated.id,
    email: updated.email,
    fullName: updated.full_name,
    isActive: updated.is_active,
    linkedStudents,
  };

  return formatSuccess({ guardian });
}
