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

interface CsvImportResultSummary {
  totalRows: number;
  importedCount: number;
  failedCount: number;
}

interface CsvImportRowError {
  rowNumber: number;
  message: string;
}

interface ParsedCsvRow {
  lrn: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  levelName: string;
  sectionName: string;
  studentEmail: string | null;
  guardianFirstName: string | null;
  guardianMiddleName: string | null;
  guardianLastName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
}

interface StudentCredential {
  studentName: string;
  email: string;
  temporaryPassword: string;
}

interface GuardianCredential {
  guardianName: string;
  email: string;
  temporaryPassword: string;
  linkedStudents: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateRandomPassword(length = 16): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

interface LevelRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface SectionRow {
  id: string;
  name: string;
  level_id: string | null;
  is_active: boolean;
}

interface StudentRow {
  id: string;
  student_school_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  section_id: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  is_active: boolean;
  created_at: string;
}

function generateQrHash(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `qr_${hex}`;
}

function parseCsv(content: string): { rows: ParsedCsvRow[]; errors: CsvImportRowError[] } {
  const rows: ParsedCsvRow[] = [];
  const errors: CsvImportRowError[] = [];

  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim());

  if (lines.length === 0) {
    return { rows, errors: [{ rowNumber: 1, message: "CSV file is empty." }] };
  }

  const headerLine = lines[0] ?? "";
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const indexOf = (name: string): number => {
    const target = name.toLowerCase();
    return headers.findIndex((h) => h.toLowerCase() === target);
  };

  const idxLrn = indexOf("ID / LRN");
  const idxFirstName = indexOf("First Name");
  const idxMiddleName = indexOf("Middle Name");
  const idxLastName = indexOf("Last Name");
  const idxLevel = indexOf("Grade / Level");
  const idxSection = indexOf("Section");
  const idxStudentEmail = indexOf("Student Email");
  const idxGuardianFirstName = indexOf("Guardian First Name");
  const idxGuardianMiddleName = indexOf("Guardian Middle Name");
  const idxGuardianLastName = indexOf("Guardian Last Name");
  const idxGuardianPhone = indexOf("Guardian Phone");
  const idxGuardianEmail = indexOf("Guardian Email");

  if (idxFirstName === -1 || idxLastName === -1 || idxLevel === -1) {
    errors.push({
      rowNumber: 1,
      message:
        "Missing required headers. Expected at least 'First Name', 'Last Name', and 'Grade / Level'.",
    });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const columns = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));

    const firstName = columns[idxFirstName] ?? "";
    const middleName =
      idxMiddleName === -1 ? null : (columns[idxMiddleName] ?? "") || null;
    const lastName = columns[idxLastName] ?? "";
    const levelName = columns[idxLevel] ?? "";

    if (!firstName || !lastName || !levelName) {
      errors.push({
        rowNumber: i + 1,
        message: "First Name, Last Name, and Grade / Level are required.",
      });
      continue;
    }

    const lrn = idxLrn === -1 ? "" : columns[idxLrn] ?? "";
    const sectionName = idxSection === -1 ? "" : columns[idxSection] ?? "";
    const studentEmail = idxStudentEmail === -1 ? null : (columns[idxStudentEmail] ?? "") || null;
    const guardianFirstName = idxGuardianFirstName === -1 ? null : (columns[idxGuardianFirstName] ?? "") || null;
    const guardianMiddleName = idxGuardianMiddleName === -1 ? null : (columns[idxGuardianMiddleName] ?? "") || null;
    const guardianLastName = idxGuardianLastName === -1 ? null : (columns[idxGuardianLastName] ?? "") || null;
    const guardianPhone = idxGuardianPhone === -1 ? null : (columns[idxGuardianPhone] ?? "") || null;
    const guardianEmail = idxGuardianEmail === -1 ? null : (columns[idxGuardianEmail] ?? "") || null;

    rows.push({
      lrn,
      firstName,
      middleName,
      lastName,
      levelName,
      sectionName,
      studentEmail,
      guardianFirstName,
      guardianMiddleName,
      guardianLastName,
      guardianPhone,
      guardianEmail,
    });
  }

  return { rows, errors };
}

export async function POST(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return formatError(400, "INVALID_FORM_DATA", "Unable to read form data.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return formatError(400, "NO_FILE", "No CSV file was uploaded.");
  }

  const text = await file.text().catch(() => "");

  const { rows, errors: parseErrors } = parseCsv(text);

  if (rows.length === 0) {
    return formatError(400, "EMPTY_IMPORT", "No valid rows found in the CSV.", parseErrors);
  }

  const rowErrors: CsvImportRowError[] = [...parseErrors];

  const resolvableRows: {
    row: ParsedCsvRow;
    rowNumber: number;
    level: LevelRow;
    section: SectionRow;
  }[] = [];

  // First pass: validate all rows (levels/sections) without inserting any students
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2; // account for header

    const { data: levelRow, error: levelError } = await supabase
      .from("levels")
      .select("id, name, is_active")
      .eq("name", row.levelName)
      .single<LevelRow>();

    if (levelError || !levelRow) {
      rowErrors.push({ rowNumber, message: "Unable to find the selected level / year." });
      continue;
    }

    const targetSectionName = (row.sectionName ?? "").trim();

    let sectionRow: SectionRow | null = null;

    if (targetSectionName) {
      const { data: explicitSectionRow, error: sectionError } = await supabase
        .from("sections")
        .select("id, name, level_id, is_active")
        .eq("name", targetSectionName)
        .eq("level_id", levelRow.id)
        .single<SectionRow>();

      if (sectionError || !explicitSectionRow) {
        rowErrors.push({ rowNumber, message: "Unable to find the selected section for this level." });
        continue;
      }

      sectionRow = explicitSectionRow;
    } else {
      // Fallback to "Unassigned" section for this level (same behavior as single-student POST)
      const fallbackName = "Unassigned";

      const { data: existingFallbackRows, error: existingFallbackError } = await supabase
        .from("sections")
        .select("id, name, level_id, is_active")
        .eq("name", fallbackName)
        .eq("level_id", levelRow.id)
        .limit(1);

      if (existingFallbackError) {
        rowErrors.push({
          rowNumber,
          message: "Unable to resolve section for this level.",
        });
        continue;
      }

      const existingFallbackList =
        (existingFallbackRows as SectionRow[] | null) ?? [];

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
          rowErrors.push({
            rowNumber,
            message: "Unable to resolve section for this level.",
          });
          continue;
        }

        sectionRow = (createdFallbackRows as SectionRow[])[0]!;
      }
    }

    resolvableRows.push({ row, rowNumber, level: levelRow, section: sectionRow });
  }

  // If any row failed validation or resolution, do not insert any students
  if (rowErrors.length > 0 || resolvableRows.length !== rows.length) {
    const summary: CsvImportResultSummary = {
      totalRows: rows.length,
      importedCount: 0,
      failedCount: rows.length,
    };

    return formatSuccess(
      {
        summary,
        errors: rowErrors,
        students: [],
      },
      200
    );
  }

  // Second pass: all rows are valid; insert students in a single batch
  const insertPayloads = resolvableRows.map(({ row, section }) => {
    const baseId = row.lrn && row.lrn.length > 0 ? row.lrn : `AUTO-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    return {
      student_school_id: baseId,
      first_name: row.firstName,
      middle_name: row.middleName,
      last_name: row.lastName,
      section_id: section.id,
      guardian_phone: row.guardianPhone,
      guardian_email: row.guardianEmail,
      qr_hash: generateQrHash(),
      is_active: true,
    };
  });

  // Use upsert for idempotency - re-running the same CSV is safe
  const { data, error } = await supabase
    .from("students")
    .upsert(insertPayloads, { onConflict: "student_school_id" })
    .select(
      "id, student_school_id, first_name, middle_name, last_name, section_id, guardian_phone, guardian_email, is_active, created_at"
    );

  if (error || !data) {
    const summary: CsvImportResultSummary = {
      totalRows: rows.length,
      importedCount: 0,
      failedCount: rows.length,
    };

    const message = (error as { message?: string } | null)?.message ?? "Unable to create students.";

    return formatSuccess(
      {
        summary,
        errors: [
          ...rowErrors,
          {
            rowNumber: 0,
            message,
          },
        ],
        students: [],
      },
      200
    );
  }

  const studentRows = data as StudentRow[];

  // Third pass: create student accounts for rows with valid Student Email
  const credentials: StudentCredential[] = [];
  const accountWarnings: CsvImportRowError[] = [];

  for (let i = 0; i < studentRows.length; i++) {
    const studentRow = studentRows[i]!;
    const source = resolvableRows[i]!.row;
    const rowNumber = resolvableRows[i]!.rowNumber;

    const studentEmail = source.studentEmail?.trim().toLowerCase() ?? null;

    // Skip if no email or invalid email format
    if (!studentEmail || !EMAIL_REGEX.test(studentEmail)) {
      if (studentEmail) {
        accountWarnings.push({
          rowNumber,
          message: `Invalid student email format: "${studentEmail}". Student imported but no login account created.`,
        });
      }
      continue;
    }

    const fullName = `${studentRow.first_name} ${studentRow.last_name}`.trim();

    try {
      // Check if app_user already exists with this email
      const { data: existingAppUser } = await supabase
        .from("app_users")
        .select("id")
        .eq("email", studentEmail)
        .maybeSingle();

      let appUserId: string;

      if (existingAppUser) {
        // User already exists, just link them
        appUserId = existingAppUser.id;
        accountWarnings.push({
          rowNumber,
          message: `Student email "${studentEmail}" already has an account. Linked to existing account.`,
        });
      } else {
        // Create new auth user
        const randomPassword = generateRandomPassword();

        const { data: createdAuthUser, error: authError } =
          await supabase.auth.admin.createUser({
            email: studentEmail,
            password: randomPassword,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
            },
          });

        if (authError || !createdAuthUser?.user) {
          const status = (authError as { status?: number } | null)?.status;
          const reason = status === 422 ? "email already in use" : "auth creation failed";
          accountWarnings.push({
            rowNumber,
            message: `Could not create login for "${studentEmail}": ${reason}. Student imported but no login account created.`,
          });
          continue;
        }

        appUserId = createdAuthUser.user.id;

        // Create app_users row
        const { error: appUserError } = await supabase.from("app_users").insert({
          id: appUserId,
          email: studentEmail,
          full_name: fullName,
          roles: ["STUDENT"],
          primary_role: "STUDENT",
          is_active: true,
        });

        if (appUserError) {
          console.error("[students/import] Failed to insert app_users row", {
            email: studentEmail,
            appUserError,
          });
          accountWarnings.push({
            rowNumber,
            message: `Could not create app user for "${studentEmail}". Student imported but login may not work.`,
          });
          continue;
        }

        credentials.push({
          studentName: fullName,
          email: studentEmail,
          temporaryPassword: randomPassword,
        });
      }

      // Create student_guardians self-link (relationship = 'self')
      const { error: linkError } = await supabase
        .from("student_guardians")
        .upsert(
          {
            student_id: studentRow.id,
            app_user_id: appUserId,
            relationship: "self",
            is_primary: true,
          },
          { onConflict: "student_id,app_user_id" }
        );

      if (linkError) {
        console.error("[students/import] Failed to create student_guardians link", {
          studentId: studentRow.id,
          appUserId,
          linkError,
        });
        accountWarnings.push({
          rowNumber,
          message: `Could not link student account for "${studentEmail}". Login created but event visibility may not work.`,
        });
      }
    } catch (err) {
      console.error("[students/import] Unexpected error creating student account", {
        email: studentEmail,
        err,
      });
      accountWarnings.push({
        rowNumber,
        message: `Unexpected error creating account for "${studentEmail}". Student imported but no login account created.`,
      });
    }
  }

  // Fourth pass: create guardian/parent accounts for rows with valid Guardian Email
  // Group by guardian email to avoid creating duplicate accounts for siblings
  const guardianEmailToStudents = new Map<
    string,
    { studentId: string; studentName: string; rowNumber: number; guardianName: string }[]
  >();

  for (let i = 0; i < studentRows.length; i++) {
    const studentRow = studentRows[i]!;
    const source = resolvableRows[i]!.row;
    const rowNumber = resolvableRows[i]!.rowNumber;

    const guardianEmail = source.guardianEmail?.trim().toLowerCase() ?? null;

    if (!guardianEmail || !EMAIL_REGEX.test(guardianEmail)) {
      if (guardianEmail) {
        accountWarnings.push({
          rowNumber,
          message: `Invalid guardian email format: "${guardianEmail}". No parent account created.`,
        });
      }
      continue;
    }

    // Build guardian full name from available fields
    const guardianNameParts = [
      source.guardianFirstName,
      source.guardianMiddleName,
      source.guardianLastName,
    ].filter(Boolean);
    const guardianName = guardianNameParts.length > 0
      ? guardianNameParts.join(" ")
      : `Guardian of ${studentRow.first_name} ${studentRow.last_name}`;

    const studentName = `${studentRow.first_name} ${studentRow.last_name}`.trim();

    const existing = guardianEmailToStudents.get(guardianEmail) ?? [];
    existing.push({
      studentId: studentRow.id,
      studentName,
      rowNumber,
      guardianName,
    });
    guardianEmailToStudents.set(guardianEmail, existing);
  }

  const guardianCredentials: GuardianCredential[] = [];

  for (const [guardianEmail, linkedStudentInfos] of guardianEmailToStudents) {
    const firstInfo = linkedStudentInfos[0]!;
    const guardianName = firstInfo.guardianName;
    const linkedStudentNames = linkedStudentInfos.map((s) => s.studentName);

    try {
      // Check if app_user already exists with this email
      const { data: existingAppUser } = await supabase
        .from("app_users")
        .select("id")
        .eq("email", guardianEmail)
        .maybeSingle();

      let appUserId: string;

      if (existingAppUser) {
        // User already exists, just link them
        appUserId = existingAppUser.id;
        accountWarnings.push({
          rowNumber: firstInfo.rowNumber,
          message: `Guardian email "${guardianEmail}" already has an account. Linked to existing account.`,
        });
      } else {
        // Create new auth user for guardian
        const randomPassword = generateRandomPassword();

        const { data: createdAuthUser, error: authError } =
          await supabase.auth.admin.createUser({
            email: guardianEmail,
            password: randomPassword,
            email_confirm: true,
            user_metadata: {
              full_name: guardianName,
            },
          });

        if (authError || !createdAuthUser?.user) {
          const status = (authError as { status?: number } | null)?.status;
          const reason = status === 422 ? "email already in use" : "auth creation failed";
          accountWarnings.push({
            rowNumber: firstInfo.rowNumber,
            message: `Could not create login for guardian "${guardianEmail}": ${reason}. No parent account created.`,
          });
          continue;
        }

        appUserId = createdAuthUser.user.id;

        // Create app_users row with PARENT role
        const { error: appUserError } = await supabase.from("app_users").insert({
          id: appUserId,
          email: guardianEmail,
          full_name: guardianName,
          roles: ["PARENT"],
          primary_role: "PARENT",
          is_active: true,
        });

        if (appUserError) {
          console.error("[students/import] Failed to insert guardian app_users row", {
            email: guardianEmail,
            appUserError,
          });
          accountWarnings.push({
            rowNumber: firstInfo.rowNumber,
            message: `Could not create app user for guardian "${guardianEmail}". Login may not work.`,
          });
          continue;
        }

        guardianCredentials.push({
          guardianName,
          email: guardianEmail,
          temporaryPassword: randomPassword,
          linkedStudents: linkedStudentNames,
        });
      }

      // Create student_guardians links for all linked students
      for (const studentInfo of linkedStudentInfos) {
        const { error: linkError } = await supabase
          .from("student_guardians")
          .upsert(
            {
              student_id: studentInfo.studentId,
              app_user_id: appUserId,
              relationship: "guardian",
              is_primary: true,
            },
            { onConflict: "student_id,app_user_id" }
          );

        if (linkError) {
          console.error("[students/import] Failed to create guardian student_guardians link", {
            studentId: studentInfo.studentId,
            appUserId,
            linkError,
          });
          accountWarnings.push({
            rowNumber: studentInfo.rowNumber,
            message: `Could not link guardian "${guardianEmail}" to student "${studentInfo.studentName}". Event visibility may not work.`,
          });
        }
      }
    } catch (err) {
      console.error("[students/import] Unexpected error creating guardian account", {
        email: guardianEmail,
        err,
      });
      accountWarnings.push({
        rowNumber: firstInfo.rowNumber,
        message: `Unexpected error creating guardian account for "${guardianEmail}".`,
      });
    }
  }

  const importedStudents = studentRows.map((row, index) => {
    const source = resolvableRows[index]!.row;
    const fullName = `${row.first_name} ${row.last_name}`.trim();

    return {
      id: row.id,
      name: fullName,
      grade: source.levelName,
      section: source.sectionName || "Unassigned",
      lrn: row.student_school_id,
      status: row.is_active ? "Active" : "Inactive",
      guardianPhone: row.guardian_phone,
      guardianEmail: row.guardian_email,
      studentEmail: source.studentEmail,
    };
  });

  const summary: CsvImportResultSummary = {
    totalRows: rows.length,
    importedCount: rows.length,
    failedCount: 0,
  };

  return formatSuccess(
    {
      summary,
      errors: accountWarnings,
      students: importedStudents,
      studentCredentials: credentials,
      guardianCredentials,
    },
    200
  );
}
