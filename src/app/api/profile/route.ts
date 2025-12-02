import type { NextRequest } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import type { UserRole } from "@/core/auth/types";
import { ALL_USER_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";
import {
  type AppUserRow,
  ALLOWED_ROLES,
  fetchCurrentAppUser,
  formatError,
  formatSuccess,
  mapAppUserToProfileDto,
  normalizeRoles,
} from "./profile-utils";

interface UpdateProfileBody {
  fullName?: string;
  schoolId?: string | null;
  primaryRole?: UserRole;
  roles?: UserRole[];
  isActive?: boolean;
}

export async function GET(request: NextRequest) {
  const roleResult = await requireRoles(request, Array.from(ALL_USER_ROLES));
  if ("error" in roleResult) {
    return roleResult.error;
  }

  const authResult = await fetchCurrentAppUser(request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const profile = mapAppUserToProfileDto(authResult.appUser, authResult.supabaseUser.last_sign_in_at);

  return formatSuccess({ profile });
}

export async function PATCH(request: NextRequest) {
  const authResult = await fetchCurrentAppUser(request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();
  const { appUser, supabaseUser } = authResult;

  const actingRoles = normalizeRoles(appUser.roles);
  const canManageRoles = actingRoles.some((role) => ["SUPER_ADMIN", "ADMIN"].includes(role));

  const body = ((await request.json().catch(() => null)) ?? {}) as UpdateProfileBody;

  const updates: Record<string, unknown> = {};

  if (typeof body.fullName === "string") {
    const fullName = body.fullName.trim();
    if (!fullName) {
      return formatError(400, "VALIDATION_ERROR", "Full name cannot be empty.");
    }
    if (fullName !== (appUser.full_name ?? "")) {
      updates.full_name = fullName;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "schoolId")) {
    const rawSchoolId = typeof body.schoolId === "string" ? body.schoolId.trim() : body.schoolId;
    if (rawSchoolId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSchoolId)) {
      return formatError(400, "INVALID_SCHOOL_ID", "School ID must be a valid UUID or null.");
    }
    const normalizedSchoolId = rawSchoolId ? rawSchoolId : null;
    if (normalizedSchoolId !== (appUser.school_id ?? null)) {
      updates.school_id = normalizedSchoolId;
    }
  }

  if (typeof body.isActive === "boolean") {
    if (!canManageRoles) {
      return formatError(403, "FORBIDDEN", "You are not allowed to change account status.");
    }
    if (body.isActive !== Boolean(appUser.is_active ?? true)) {
      updates.is_active = body.isActive;
    }
  }

  if (typeof body.primaryRole === "string") {
    const normalizedPrimary = body.primaryRole.toUpperCase() as UserRole;
    if (!ALLOWED_ROLES.includes(normalizedPrimary)) {
      return formatError(400, "INVALID_ROLE", "Primary role is invalid.");
    }
    if (!canManageRoles && normalizedPrimary !== appUser.primary_role) {
      return formatError(403, "FORBIDDEN", "You are not allowed to change roles.");
    }
    if (normalizedPrimary !== appUser.primary_role) {
      updates.primary_role = normalizedPrimary;
    }
  }

  if (Array.isArray(body.roles)) {
    if (!canManageRoles) {
      return formatError(403, "FORBIDDEN", "You are not allowed to change roles.");
    }
    const normalized = normalizeRoles(body.roles);
    if (!normalized.length) {
      return formatError(400, "INVALID_ROLE", "At least one role must be selected.");
    }
    const currentRoles = normalizeRoles(appUser.roles);
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

  const resultingPrimary = (updates.primary_role as UserRole | undefined) ??
    (appUser.primary_role as UserRole | null) ??
    actingRoles[0] ??
    "STAFF";

  const resultingRoles = Array.from(
    new Set(
      (
        (updates.roles as UserRole[] | undefined) ?? actingRoles
      ).concat(resultingPrimary)
    )
  );

  updates.primary_role = resultingPrimary;
  updates.roles = resultingRoles;
  updates.updated_at = new Date().toISOString();
  updates.updated_by = appUser.id;

  const { data: updatedUser, error: updateError } = await supabase
    .from("app_users")
    .update(updates)
    .eq("id", appUser.id)
    .select(
      "id, email, full_name, roles, primary_role, is_active, school_id, created_at, updated_at, created_by, updated_by"
    )
    .single<AppUserRow>();

  if (updateError || !updatedUser) {
    return formatError(
      500,
      "UPDATE_FAILED",
      "Unable to update profile at this time.",
      updateError?.message ?? updateError
    );
  }

  const profile = mapAppUserToProfileDto(updatedUser, supabaseUser.last_sign_in_at);

  return formatSuccess({ profile });
}
