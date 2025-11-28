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

interface AppUserRow {
  id: string;
  email: string;
  full_name: string;
  roles: string[] | null;
  primary_role: string | null;
  is_active: boolean;
  created_at: string;
}

type UserListItemDto = {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  primaryRole: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

function normalizeRoles(roles: string[] | null | undefined): UserRole[] {
  if (!Array.isArray(roles)) return [];
  const upper = roles
    .map((role) => (typeof role === "string" ? role.toUpperCase() : ""))
    .filter(Boolean);

  const allowed: UserRole[] = [
    "SUPER_ADMIN",
    "ADMIN",
    "SCANNER",
    "TEACHER",
    "STAFF",
    "PARENT",
  ];

  return Array.from(new Set(upper)).filter((role): role is UserRole =>
    allowed.includes(role as UserRole)
  );
}

function mapRowToDto(row: AppUserRow): UserListItemDto {
  const roles = normalizeRoles(row.roles);
  const primaryRole = row.primary_role
    ? normalizeRoles([row.primary_role])[0] ?? roles[0] ?? "STAFF"
    : roles[0] ?? "STAFF";

  if (!roles.length) {
    roles.push(primaryRole);
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    roles,
    primaryRole,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLoginAt: null,
  };
}

interface ToggleStatusBody {
  userId?: string;
  isActive?: boolean;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const { appUser: actingUser } = authResult;
  const supabase = getAdminSupabaseClient();
  const body = (await request.json().catch(() => null)) as ToggleStatusBody | null;
  const userId = body?.userId?.trim();
  const isActive = body?.isActive;

  if (!userId || typeof isActive !== "boolean") {
    return formatError(400, "VALIDATION_ERROR", "userId and isActive are required.");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return formatError(400, "INVALID_USER_ID", "User ID must be a valid UUID.");
  }

  if (userId === actingUser.id) {
    return formatError(400, "SELF_TOGGLE_NOT_ALLOWED", "You cannot change your own status.");
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("app_users")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
      updated_by: actingUser.id,
    })
    .eq("id", userId)
    .select("id, email, full_name, roles, primary_role, is_active, created_at");

  if (updateError) {
    return formatError(
      500,
      "USER_STATUS_UPDATE_FAILED",
      "Unable to update user status.",
      updateError.message ?? updateError
    );
  }

  const updatedUser = (updatedRows as AppUserRow[] | null)?.[0];

  if (!updatedUser) {
    return formatError(
      404,
      "USER_NOT_FOUND",
      "User not found after update."
    );
  }

  return formatSuccess({ user: mapRowToDto(updatedUser) });
}
