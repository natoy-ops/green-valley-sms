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
  lastName: string;
  levelName: string;
  sectionName: string;
  guardianPhone: string | null;
  guardianEmail: string | null;
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
  const idxLastName = indexOf("Last Name");
  const idxLevel = indexOf("Grade / Level");
  const idxSection = indexOf("Section");
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
    const guardianPhone = idxGuardianPhone === -1 ? null : (columns[idxGuardianPhone] ?? "") || null;
    const guardianEmail = idxGuardianEmail === -1 ? null : (columns[idxGuardianEmail] ?? "") || null;

    rows.push({
      lrn,
      firstName,
      lastName,
      levelName,
      sectionName,
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
      last_name: row.lastName,
      section_id: section.id,
      guardian_phone: row.guardianPhone,
      guardian_email: row.guardianEmail,
      qr_hash: generateQrHash(),
      is_active: true,
    };
  });

  const { data, error } = await supabase
    .from("students")
    .insert(insertPayloads)
    .select(
      "id, student_school_id, first_name, last_name, section_id, guardian_phone, guardian_email, is_active, created_at"
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
      errors: [],
      students: importedStudents,
    },
    200
  );
}
