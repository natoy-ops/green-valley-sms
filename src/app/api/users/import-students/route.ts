import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { ADMIN_ROLES } from "@/config/roles";
import type { UserRole } from "@/core/auth/types";
import { requireRoles } from "@/core/auth/server-role-guard";

export const runtime = "nodejs";

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

function generateRandomPassword(length = 24): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

function getCellText(value: unknown): string {
  if (typeof value === "string") return value;

  if (value && typeof value === "object") {
    const v = value as { text?: unknown; address?: unknown };
    if (typeof v.text === "string") return v.text;
    if (typeof v.address === "string") return v.address;
  }

  return String(value ?? "");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const { appUser: actingUser } = authResult;

  const formData = await request.formData();
  const file = formData.get("file");
  const rawRole = formData.get("role");

  if (!file || typeof file === "string") {
    return formatError(400, "NO_FILE", "An Excel file is required.");
  }

  const allowedRoles: UserRole[] = [
    "TEACHER",
    "STUDENT",
    "STAFF",
    "PARENT",
    "SCANNER",
  ];

  const selectedRole =
    typeof rawRole === "string" ? (rawRole.toUpperCase() as UserRole) : undefined;

  if (!selectedRole || !allowedRoles.includes(selectedRole)) {
    return formatError(
      400,
      "INVALID_ROLE",
      "Role is required and must be one of: Teacher, Student, Staff, Parent, Scanner."
    );
  }

  const fileObj = file as File;

  const arrayBuffer = await fileObj.arrayBuffer();

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(arrayBuffer as any);
  } catch (error) {
    console.error("[/api/users/import-students] Failed to parse Excel file", { error });
    return formatError(400, "INVALID_EXCEL", "Unable to read Excel file.", error);
  }

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return formatError(400, "NO_WORKSHEET", "The Excel file does not contain any worksheets.");
  }

  const headerRow = worksheet.getRow(1);
  const headerMap: { fullName?: number; email?: number } = {};

  headerRow.eachCell((cell, colNumber) => {
    const raw = getCellText(cell.value).toLowerCase().trim();
    if (raw === "full name" || raw === "name") {
      headerMap.fullName = colNumber;
    }
    if (raw === "email" || raw === "email address") {
      headerMap.email = colNumber;
    }
  });

  if (!headerMap.fullName || !headerMap.email) {
    return formatError(
      400,
      "MISSING_HEADERS",
      "The Excel file must have 'Full Name' and 'Email' headers in the first row."
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const supabase = getAdminSupabaseClient();

  let total = 0;
  let created = 0;
  let skipped = 0;

  type ImportedCredentialDto = {
    email: string;
    temporaryPassword: string;
  };

  const credentials: ImportedCredentialDto[] = [];

  type RowErrorDto = {
    row: number;
    email: string | null;
    reason: string;
  };

  const rowErrors: RowErrorDto[] = [];

  const seenEmails = new Set<string>();
  const maxRows = 1000;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount && rowNumber <= maxRows + 1; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const fullNameCell = row.getCell(headerMap.fullName);
    const emailCell = row.getCell(headerMap.email);

    const rawFullName = getCellText(fullNameCell.value);
    const rawEmail = getCellText(emailCell.value);

    const fullName = rawFullName.trim();
    const email = rawEmail.trim().toLowerCase();

    if (!fullName && !email) {
      continue;
    }

    total += 1;

    if (!fullName || !email || !emailRegex.test(email)) {
      rowErrors.push({
        row: rowNumber,
        email: rawEmail.trim() || null,
        reason: !fullName || !email ? "MISSING_REQUIRED_FIELDS" : "INVALID_EMAIL",
      });
      skipped += 1;
      continue;
    }

    if (seenEmails.has(email)) {
      rowErrors.push({ row: rowNumber, email, reason: "DUPLICATE_IN_FILE" });
      skipped += 1;
      continue;
    }

    seenEmails.add(email);

    try {
      const randomPassword = generateRandomPassword();

      const {
        data: createdUserResult,
        error: createUserError,
      } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (createUserError || !createdUserResult?.user) {
        console.error("[/api/users/import-students] Failed to create auth user", {
          email,
          createUserError,
        });
        const status = (createUserError as { status?: number } | null)?.status;
        const reason = status === 422 ? "EMAIL_IN_USE" : "AUTH_CREATE_FAILED";
        rowErrors.push({ row: rowNumber, email, reason });
        skipped += 1;
        continue;
      }

      const authUser = createdUserResult.user;

      const { error: appUserInsertError } = await supabase.from("app_users").insert({
        id: authUser.id,
        email,
        full_name: fullName,
        roles: [selectedRole],
        primary_role: selectedRole,
        is_active: true,
        created_by: actingUser.id,
      });

      if (appUserInsertError) {
        console.error("[/api/users/import-students] Failed to insert app_users row", {
          email,
          appUserInsertError,
        });
        rowErrors.push({ row: rowNumber, email, reason: "APP_USER_INSERT_FAILED" });
        skipped += 1;
        continue;
      }

      created += 1;
      credentials.push({ email, temporaryPassword: randomPassword });
    } catch (error) {
      console.error("[/api/users/import-students] Failed to import student row", {
        email,
        error,
      });
      rowErrors.push({ row: rowNumber, email, reason: "UNKNOWN_ERROR" });
      skipped += 1;
    }
  }

  return formatSuccess({ summary: { total, created, skipped }, credentials, rowErrors }, 201);
}
