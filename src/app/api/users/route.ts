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

type AppUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[] | null;
  primary_role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  last_login_at: string | null;
};

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

interface CreateUserBody {
  fullName?: string;
  email?: string;
  role?: UserRole;
}

interface UpdateUserBody {
  userId?: string;
  primaryRole?: UserRole;
  roles?: UserRole[];
}

function validateCreateUserBody(body: unknown): {
  value?: { fullName: string; email: string; role: UserRole };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawFullName = typeof data.fullName === "string" ? data.fullName.trim() : "";
  const rawEmail = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const rawRole = typeof data.role === "string" ? (data.role as UserRole) : undefined;

  if (!rawFullName) {
    errors.push({ field: "fullName", message: "Full name is required." });
  }

  if (!rawEmail) {
    errors.push({ field: "email", message: "Email is required." });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    errors.push({ field: "email", message: "Email is invalid." });
  }

  const allowedRoles: UserRole[] = [
    "SUPER_ADMIN",
    "ADMIN",
    "SCANNER",
    "TEACHER",
    "STUDENT",
    "STAFF",
    "PARENT",
  ];

  if (!rawRole || !allowedRoles.includes(rawRole)) {
    errors.push({ field: "role", message: "Role is required and must be valid." });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      fullName: rawFullName,
      email: rawEmail,
      role: rawRole!,
    },
  };
}

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
    "STUDENT",
    "STAFF",
    "PARENT",
  ];

  return unique.filter((r): r is UserRole => allowed.includes(r as UserRole));
}

function mapAppUserToDto(row: AppUserRow): UserListItemDto {
  const roles = normalizeRoles(row.roles);
  const primaryRole: UserRole =
    (row.primary_role && normalizeRoles([row.primary_role])[0]) || roles[0] || "STAFF";

  if (!roles.length) {
    roles.push(primaryRole);
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.email,
    roles,
    primaryRole,
    isActive: Boolean(row.is_active ?? true),
    createdAt: row.created_at ?? new Date().toISOString(),
    lastLoginAt: row.last_login_at ?? null,
  };
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, roles, primary_role, is_active, created_at, last_login_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[/api/users] Failed to list users", { error });
    return formatError(
      500,
      "USER_LIST_FAILED",
      "Unable to load users.",
      error.message ?? error
    );
  }

  const users = (data ?? []).map((row) => mapAppUserToDto(row as AppUserRow));

  return formatSuccess({ users });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const { appUser: actingUser } = authResult;

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null as CreateUserBody | null);
  const { value, errors } = validateCreateUserBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid user data.", errors);
  }

  const { fullName, email, role } = value;

  // Step 1: Create auth user with a random password (no automatic invitation)
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
    console.error("[/api/users] Failed to create auth user", {
      email,
      createUserError,
    });

    const code =
      (createUserError as { status?: number } | null)?.status === 422
        ? "EMAIL_IN_USE"
        : "USER_CREATE_FAILED";

    const message =
      code === "EMAIL_IN_USE"
        ? "A user with this email already exists."
        : "Unable to create user account.";

    return formatError(400, code, message, createUserError?.message ?? createUserError);
  }

  const authUser = createdUserResult.user;

  // Step 2: Insert into app_users
  const { data: appUserRow, error: appUserInsertError } = await supabase
    .from("app_users")
    .insert({
      id: authUser.id,
      email,
      full_name: fullName,
      roles: [role],
      primary_role: role,
      is_active: true,
      created_by: actingUser.id,
    })
    .select("id, email, full_name, roles, primary_role, is_active, created_at")
    .single<AppUserRow>();

  if (appUserInsertError || !appUserRow) {
    console.error("[/api/users] Failed to insert app_users row", {
      email,
      appUserInsertError,
    });

    return formatError(
      500,
      "APP_USER_CREATE_FAILED",
      "Unable to create application user.",
      appUserInsertError?.message ?? appUserInsertError
    );
  }

  const userDto = mapAppUserToDto(appUserRow);

  return formatSuccess({ user: userDto }, 201);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = ((await request.json().catch(() => null)) ?? {}) as UpdateUserBody;

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return formatError(400, "VALIDATION_ERROR", "User ID is required.");
  }

  const { data: existingUser, error: fetchError } = await supabase
    .from("app_users")
    .select("id, email, full_name, roles, primary_role, is_active, created_at, last_login_at")
    .eq("id", userId)
    .single<AppUserRow>();

  if (fetchError || !existingUser) {
    return formatError(404, "USER_NOT_FOUND", "User not found.", fetchError?.message ?? fetchError);
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.primaryRole === "string") {
    const normalizedPrimary = body.primaryRole.toUpperCase() as UserRole;
    const allowed: UserRole[] = [
      "SUPER_ADMIN",
      "ADMIN",
      "SCANNER",
      "TEACHER",
      "STUDENT",
      "STAFF",
      "PARENT",
    ];

    if (!allowed.includes(normalizedPrimary)) {
      return formatError(400, "INVALID_ROLE", "Primary role is invalid.");
    }

    if (normalizedPrimary !== (existingUser.primary_role as UserRole | null)) {
      updates.primary_role = normalizedPrimary;
    }
  }

  if (Array.isArray(body.roles)) {
    const normalized = normalizeRoles(body.roles as string[]);
    if (!normalized.length) {
      return formatError(400, "INVALID_ROLE", "At least one role must be selected.");
    }

    const currentRoles = normalizeRoles(existingUser.roles);
    const rolesChanged =
      normalized.length !== currentRoles.length ||
      normalized.some((role) => !currentRoles.includes(role));

    if (rolesChanged) {
      updates.roles = normalized;
    }
  }

  if (!Object.keys(updates).length) {
    return formatError(400, "NO_CHANGES", "No updates were provided.");
  }

  const currentRoles = normalizeRoles(existingUser.roles);
  const resultingPrimary: UserRole =
    (updates.primary_role as UserRole | undefined) ??
    (existingUser.primary_role as UserRole | null) ??
    currentRoles[0] ??
    "STAFF";

  const resultingRoles = Array.from(
    new Set(
      ((updates.roles as UserRole[] | undefined) ?? currentRoles).concat(resultingPrimary)
    )
  );

  updates.primary_role = resultingPrimary;
  updates.roles = resultingRoles;

  const { data: updatedRow, error: updateError } = await supabase
    .from("app_users")
    .update(updates)
    .eq("id", userId)
    .select("id, email, full_name, roles, primary_role, is_active, created_at, last_login_at")
    .single<AppUserRow>();

  if (updateError || !updatedRow) {
    return formatError(
      500,
      "UPDATE_FAILED",
      "Unable to update user at this time.",
      updateError?.message ?? updateError
    );
  }

  const userDto = mapAppUserToDto(updatedRow);

  return formatSuccess({ user: userDto });
}
