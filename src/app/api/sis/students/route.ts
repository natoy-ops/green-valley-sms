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

type StudentStatusDto = "Active" | "Inactive";

interface StudentRow {
  id: string;
  student_school_id: string;
  first_name: string;
  last_name: string;
  section_id: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  is_active: boolean;
  created_at: string;
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

interface StudentDto {
  id: string;
  name: string;
  grade: string;
  section: string;
  lrn: string;
  status: StudentStatusDto;
  guardianPhone: string | null;
  guardianEmail: string | null;
}

function buildStudentDto(
  row: StudentRow,
  levelName: string | null,
  sectionName: string | null
): StudentDto {
  const fullName = `${row.first_name} ${row.last_name}`.trim();

  return {
    id: row.id,
    name: fullName,
    grade: levelName ?? "Unknown level",
    section: sectionName ?? "Unknown section",
    lrn: row.student_school_id,
    status: row.is_active ? "Active" : "Inactive",
    guardianPhone: row.guardian_phone,
    guardianEmail: row.guardian_email,
  };
}

function generateQrHash(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `qr_${hex}`;
}

interface CreateStudentBody {
  name?: string;
  levelName?: string;
  sectionName?: string;
  lrn?: string;
  status?: string;
  guardianPhone?: string;
  guardianEmail?: string;
}

interface UpdateStudentBody {
  id?: string;
  name?: string;
  levelName?: string;
  sectionName?: string;
  lrn?: string;
  status?: string;
  guardianPhone?: string;
  guardianEmail?: string;
}

function validateCreateStudentBody(body: unknown): {
  value?: {
    firstName: string;
    lastName: string;
    levelName: string;
    sectionName: string;
    lrn: string | null;
    status: StudentStatusDto | "Pending";
    guardianPhone: string | null;
    guardianEmail: string | null;
  };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawName = typeof data.name === "string" ? data.name.trim() : "";
  const rawLevelName = typeof data.levelName === "string" ? data.levelName.trim() : "";
  const rawSectionName =
    typeof data.sectionName === "string" ? data.sectionName.trim() : "";
  const rawLrn = typeof data.lrn === "string" ? data.lrn.trim() : "";
  const rawGuardianPhone =
    typeof data.guardianPhone === "string" ? data.guardianPhone.trim() : "";
  const rawGuardianEmail =
    typeof data.guardianEmail === "string" ? data.guardianEmail.trim() : "";

  if (!rawName) {
    errors.push({ field: "name", message: "Full name is required." });
  } else if (rawName.length > 150) {
    errors.push({ field: "name", message: "Full name must be at most 150 characters." });
  }

  if (!rawLevelName) {
    errors.push({ field: "levelName", message: "Level / Year is required." });
  }

  if (rawLrn && rawLrn.length > 50) {
    errors.push({ field: "lrn", message: "LRN / Student ID must be at most 50 characters." });
  }

  if (rawGuardianPhone && rawGuardianPhone.length > 50) {
    errors.push({ field: "guardianPhone", message: "Guardian phone must be at most 50 characters." });
  }

  if (rawGuardianEmail && rawGuardianEmail.length > 255) {
    errors.push({ field: "guardianEmail", message: "Guardian email must be at most 255 characters." });
  }

  let status: StudentStatusDto | "Pending" = "Active";
  if (typeof data.status === "string") {
    const normalized = data.status.trim();
    if (normalized === "Active" || normalized === "Inactive" || normalized === "Pending") {
      status = normalized as StudentStatusDto | "Pending";
    } else {
      errors.push({ field: "status", message: "Invalid status value." });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const nameParts = rawName.split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  return {
    value: {
      firstName,
      lastName,
      levelName: rawLevelName,
      sectionName: rawSectionName,
      lrn: rawLrn || null,
      status,
      guardianPhone: rawGuardianPhone || null,
      guardianEmail: rawGuardianEmail || null,
    },
  };
}

function validateUpdateStudentBody(body: unknown): {
  value?: {
    id: string;
    firstName: string;
    lastName: string;
    levelName: string;
    sectionName: string;
    lrn: string | null;
    status: StudentStatusDto | "Pending";
    guardianPhone: string | null;
    guardianEmail: string | null;
  };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawId = typeof data.id === "string" ? data.id.trim() : "";
  const rawName = typeof data.name === "string" ? data.name.trim() : "";
  const rawLevelName = typeof data.levelName === "string" ? data.levelName.trim() : "";
  const rawSectionName =
    typeof data.sectionName === "string" ? data.sectionName.trim() : "";
  const rawLrn = typeof data.lrn === "string" ? data.lrn.trim() : "";
  const rawGuardianPhone =
    typeof data.guardianPhone === "string" ? data.guardianPhone.trim() : "";
  const rawGuardianEmail =
    typeof data.guardianEmail === "string" ? data.guardianEmail.trim() : "";

  if (!rawId) {
    errors.push({ field: "id", message: "Student ID is required." });
  }

  if (!rawName) {
    errors.push({ field: "name", message: "Full name is required." });
  } else if (rawName.length > 150) {
    errors.push({ field: "name", message: "Full name must be at most 150 characters." });
  }

  if (!rawLevelName) {
    errors.push({ field: "levelName", message: "Level / Year is required." });
  }

  if (rawLrn && rawLrn.length > 50) {
    errors.push({ field: "lrn", message: "LRN / Student ID must be at most 50 characters." });
  }

  if (rawGuardianPhone && rawGuardianPhone.length > 50) {
    errors.push({ field: "guardianPhone", message: "Guardian phone must be at most 50 characters." });
  }

  if (rawGuardianEmail && rawGuardianEmail.length > 255) {
    errors.push({ field: "guardianEmail", message: "Guardian email must be at most 255 characters." });
  }

  let status: StudentStatusDto | "Pending" = "Active";
  if (typeof data.status === "string") {
    const normalized = data.status.trim();
    if (normalized === "Active" || normalized === "Inactive" || normalized === "Pending") {
      status = normalized as StudentStatusDto | "Pending";
    } else {
      errors.push({ field: "status", message: "Invalid status value." });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const nameParts = rawName.split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  return {
    value: {
      id: rawId,
      firstName,
      lastName,
      levelName: rawLevelName,
      sectionName: rawSectionName,
      lrn: rawLrn || null,
      status,
      guardianPhone: rawGuardianPhone || null,
      guardianEmail: rawGuardianEmail || null,
    },
  };
}

export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const { data: studentRows, error: studentsError } = await supabase
    .from("students")
    .select("id, student_school_id, first_name, last_name, section_id, guardian_phone, guardian_email, is_active, created_at")
    .order("created_at", { ascending: false });

  if (studentsError) {
    return formatError(
      500,
      "STUDENT_LIST_FAILED",
      "Unable to load students.",
      studentsError.message ?? studentsError
    );
  }

  const rows = (studentRows ?? []) as StudentRow[];

  if (rows.length === 0) {
    return formatSuccess<{ students: StudentDto[] }>({ students: [] });
  }

  const sectionIds = Array.from(new Set(rows.map((row) => row.section_id).filter(Boolean)));

  const { data: sectionRows, error: sectionsError } = await supabase
    .from("sections")
    .select("id, name, level_id")
    .in("id", sectionIds as string[]);

  if (sectionsError) {
    return formatError(
      500,
      "SECTION_LOOKUP_FAILED",
      "Unable to resolve sections for students.",
      sectionsError.message ?? sectionsError
    );
  }

  const sectionList = (sectionRows ?? []) as SectionRow[];
  const levelIds = Array.from(
    new Set(sectionList.map((section) => section.level_id).filter((id): id is string => !!id))
  );

  const { data: levelRows, error: levelsError } = await supabase
    .from("levels")
    .select("id, name")
    .in("id", levelIds as string[]);

  if (levelsError) {
    return formatError(
      500,
      "LEVEL_LOOKUP_FAILED",
      "Unable to resolve levels for students.",
      levelsError.message ?? levelsError
    );
  }

  const sectionsById = new Map(sectionList.map((section) => [section.id, section]));
  const levelsById = new Map(((levelRows ?? []) as LevelRow[]).map((level) => [level.id, level]));

  const students: StudentDto[] = rows.map((row) => {
    const section = sectionsById.get(row.section_id) ?? null;
    const level = section && section.level_id ? levelsById.get(section.level_id) ?? null : null;

    return buildStudentDto(row, level?.name ?? null, section?.name ?? null);
  });

  return formatSuccess<{ students: StudentDto[] }>({ students });
}

export async function POST(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateCreateStudentBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid student data.", errors);
  }

  const { data: levelRow, error: levelError } = await supabase
    .from("levels")
    .select("id, name, is_active")
    .eq("name", value.levelName)
    .single<{ id: string; name: string; is_active: boolean }>();

  if (levelError || !levelRow) {
    return formatError(
      400,
      "LEVEL_NOT_FOUND",
      "Unable to find the selected level / year.",
      levelError?.message ?? levelError
    );
  }

  const targetSectionName = (value.sectionName ?? "").trim();

  let sectionRow: { id: string; name: string; level_id: string | null; is_active: boolean } | null =
    null;

  if (targetSectionName) {
    const { data: explicitSectionRow, error: sectionError } = await supabase
      .from("sections")
      .select("id, name, level_id, is_active")
      .eq("name", targetSectionName)
      .eq("level_id", levelRow.id)
      .single<{ id: string; name: string; level_id: string | null; is_active: boolean }>();

    if (sectionError || !explicitSectionRow) {
      return formatError(
        400,
        "SECTION_NOT_FOUND",
        "Unable to find the selected section for this level.",
        sectionError?.message ?? sectionError
      );
    }

    sectionRow = explicitSectionRow;
  } else {
    const fallbackName = "Unassigned";

    const { data: existingFallbackRows, error: existingFallbackError } = await supabase
      .from("sections")
      .select("id, name, level_id, is_active")
      .eq("name", fallbackName)
      .eq("level_id", levelRow.id)
      .limit(1);

    if (existingFallbackError) {
      return formatError(
        500,
        "SECTION_LOOKUP_FAILED",
        "Unable to resolve section for this level.",
        existingFallbackError.message ?? existingFallbackError
      );
    }

    const existingFallbackList =
      (existingFallbackRows as {
        id: string;
        name: string;
        level_id: string | null;
        is_active: boolean;
      }[] | null) ?? [];

    if (existingFallbackList.length > 0) {
      sectionRow = existingFallbackList[0]!;
    } else {
      const { data: createdFallbackRows, error: createFallbackError } = await supabase
        .from("sections")
        .insert({
          level_id: levelRow.id,
          name: fallbackName,
          is_active: true,
        })
        .select("id, name, level_id, is_active")
        .limit(1);

      if (createFallbackError || !createdFallbackRows || createdFallbackRows.length === 0) {
        return formatError(
          500,
          "SECTION_CREATE_FAILED",
          "Unable to create fallback section for this level.",
          (createFallbackError as { message?: string } | null)?.message ?? createFallbackError
        );
      }

      sectionRow = createdFallbackRows[0] as {
        id: string;
        name: string;
        level_id: string | null;
        is_active: boolean;
      };
    }
  }

  const isActive = value.status === "Inactive" ? false : true;

  const studentSchoolId = value.lrn && value.lrn.length > 0 ? value.lrn : `AUTO-${Date.now()}`;

  const insertPayload = {
    student_school_id: studentSchoolId,
    first_name: value.firstName,
    last_name: value.lastName,
    section_id: sectionRow.id,
    guardian_phone: value.guardianPhone,
    guardian_email: value.guardianEmail,
    qr_hash: generateQrHash(),
    is_active: isActive,
  };

  const { data, error } = await supabase
    .from("students")
    .insert(insertPayload)
    .select("id, student_school_id, first_name, last_name, section_id, guardian_phone, guardian_email, is_active, created_at")
    .single<StudentRow>();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;

    if (code === "23505") {
      return formatError(400, "DUPLICATE_STUDENT", "A student with this ID already exists.", [
        { field: "lrn", message: "LRN / Student ID must be unique." },
      ]);
    }

    return formatError(
      500,
      "STUDENT_CREATE_FAILED",
      "Unable to create student.",
      (error as { message?: string } | null)?.message ?? error
    );
  }

  const student = buildStudentDto(data, levelRow.name, sectionRow.name);

  return formatSuccess<{ student: StudentDto }>({ student }, 201);
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateUpdateStudentBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid student data.", errors);
  }

  const { data: existingStudentRow, error: existingStudentError } = await supabase
    .from("students")
    .select("id, student_school_id, section_id, guardian_phone, guardian_email, is_active, first_name, last_name, created_at")
    .eq("id", value.id)
    .single<StudentRow>();

  if (existingStudentError || !existingStudentRow) {
    return formatError(404, "STUDENT_NOT_FOUND", "Student not found.", existingStudentError);
  }

  const { data: levelRow, error: levelError } = await supabase
    .from("levels")
    .select("id, name, is_active")
    .eq("name", value.levelName)
    .single<{ id: string; name: string; is_active: boolean }>();

  if (levelError || !levelRow) {
    return formatError(
      400,
      "LEVEL_NOT_FOUND",
      "Unable to find the selected level / year.",
      levelError?.message ?? levelError
    );
  }

  const { data: sectionRow, error: sectionError } = await supabase
    .from("sections")
    .select("id, name, level_id, is_active")
    .eq("name", value.sectionName)
    .eq("level_id", levelRow.id)
    .single<{ id: string; name: string; level_id: string | null; is_active: boolean }>();

  if (sectionError || !sectionRow) {
    return formatError(
      400,
      "SECTION_NOT_FOUND",
      "Unable to find the selected section for this level.",
      sectionError?.message ?? sectionError
    );
  }

  const isActive = value.status === "Inactive" ? false : true;

  const nextStudentSchoolId =
    value.lrn && value.lrn.length > 0 ? value.lrn : existingStudentRow.student_school_id;

  const updatePayload = {
    student_school_id: nextStudentSchoolId,
    first_name: value.firstName,
    last_name: value.lastName,
    section_id: sectionRow.id,
    guardian_phone: value.guardianPhone,
    guardian_email: value.guardianEmail,
    is_active: isActive,
    ...(nextStudentSchoolId !== existingStudentRow.student_school_id
      ? { qr_hash: generateQrHash() }
      : {}),
  };

  const { data, error } = await supabase
    .from("students")
    .update(updatePayload)
    .eq("id", value.id)
    .select("id, student_school_id, first_name, last_name, section_id, guardian_phone, guardian_email, is_active, created_at")
    .single<StudentRow>();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;

    if (code === "23505") {
      return formatError(400, "DUPLICATE_STUDENT", "A student with this ID already exists.", [
        { field: "lrn", message: "LRN / Student ID must be unique." },
      ]);
    }

    return formatError(
      500,
      "STUDENT_UPDATE_FAILED",
      "Unable to update student.",
      (error as { message?: string } | null)?.message ?? error
    );
  }

  const student = buildStudentDto(data, levelRow.name, sectionRow.name);

  return formatSuccess<{ student: StudentDto }>({ student });
}
