import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import type { UserRole } from "@/core/auth/types";
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

type ActingUserRow = {
  id: string;
  roles: string[] | null;
  primary_role: string | null;
  is_active: boolean | null;
};

function normalizeRoles(roles: string[] | null | undefined): UserRole[] {
  if (!Array.isArray(roles)) return [];

  const upper = roles
    .map((r) => (typeof r === "string" ? r.toUpperCase() : ""))
    .filter(Boolean) as string[];

  const unique = Array.from(new Set(upper));

  const allowed: UserRole[] = [
    "SUPER_ADMIN",
    "ADMIN",
    "SCANNER",
    "TEACHER",
    "STAFF",
    "PARENT",
  ];

  return unique.filter((r): r is UserRole => allowed.includes(r as UserRole));
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

interface ResetPasswordBody {
  userId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = (await request.json().catch(() => null)) as ResetPasswordBody | null;
  const userId = body?.userId?.trim();

  if (!userId) {
    return formatError(400, "VALIDATION_ERROR", "User ID is required.");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return formatError(400, "INVALID_USER_ID", "User ID must be a valid UUID.");
  }

  const newPassword = generateRandomPassword();

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    console.error("[/api/users/reset-password] Failed to reset password", {
      userId,
      updateError,
    });
    return formatError(
      500,
      "RESET_PASSWORD_FAILED",
      "Unable to reset password.",
      updateError.message ?? updateError
    );
  }

  return formatSuccess({ password: newPassword }, 200);
}
