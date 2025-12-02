import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { ADMIN_ROLES, ADMIN_TEACHER_ROLES } from "@/config/roles";
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

type SectionRow = {
  id: string;
  name: string;
  level_id: string | null;
  created_at: string;
  is_active: boolean;
};

type SectionDto = {
  id: string;
  name: string;
  levelId: string | null;
  isActive: boolean;
};

function mapSectionRow(row: SectionRow): SectionDto {
  return {
    id: row.id,
    name: row.name,
    levelId: row.level_id,
    isActive: row.is_active,
  };
}

interface CreateSectionBody {
  name?: string;
  levelId?: string | null;
}

function validateCreateSectionBody(body: unknown): {
  value?: { name: string; levelId: string | null };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawName = typeof data.name === "string" ? data.name.trim() : "";
  const rawLevelId =
    typeof data.levelId === "string" && data.levelId.trim().length > 0
      ? data.levelId.trim()
      : null;

  if (!rawName) {
    errors.push({ field: "name", message: "Section name is required." });
  } else if (rawName.length > 100) {
    errors.push({ field: "name", message: "Section name must be at most 100 characters." });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      name: rawName,
      levelId: rawLevelId,
    },
  };
}

interface UpdateSectionBody {
  id?: string;
  name?: string;
  levelId?: string | null;
}

function validateUpdateSectionBody(body: unknown): {
  value?: { id: string; name?: string; levelId?: string | null; isActive?: boolean };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawId = typeof data.id === "string" ? data.id.trim() : "";
  const hasName = typeof data.name === "string";
  const rawName = hasName && typeof data.name === "string" ? data.name.trim() : "";
  const rawLevelId =
    typeof data.levelId === "string" && data.levelId.trim().length > 0
      ? data.levelId.trim()
      : null;
  const hasIsActive = typeof data.isActive === "boolean";
  const rawIsActive = hasIsActive ? (data.isActive as boolean) : undefined;

  if (!rawId) {
    errors.push({ field: "id", message: "Section id is required." });
  }

  if (hasName) {
    if (!rawName) {
      errors.push({ field: "name", message: "Section name is required." });
    } else if (rawName.length > 100) {
      errors.push({ field: "name", message: "Section name must be at most 100 characters." });
    }
  }

  if (!hasName && !hasIsActive && typeof data.levelId === "undefined") {
    errors.push({ field: "payload", message: "Nothing to update. Provide name, levelId, or isActive." });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      id: rawId,
      ...(hasName ? { name: rawName } : {}),
      ...(typeof data.levelId !== "undefined" ? { levelId: rawLevelId } : {}),
      ...(hasIsActive ? { isActive: rawIsActive } : {}),
    },
  };
}

export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_TEACHER_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const url = new URL(request.url);
  const levelId = url.searchParams.get("levelId");
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  let query = supabase
    .from("sections")
    .select("id, name, level_id, created_at, is_active")
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  if (levelId) {
    query = query.eq("level_id", levelId);
  }

  const { data, error } = await query;

  if (error) {
    return formatError(
      500,
      "SECTION_LIST_FAILED",
      "Unable to load sections.",
      error.message ?? error
    );
  }

  const sections = (data ?? []).map(mapSectionRow);
  return formatSuccess<{ sections: SectionDto[] }>({ sections });
}

export async function POST(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateCreateSectionBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid section data.", errors);
  }

  const insertPayload = {
    name: value.name,
    level_id: value.levelId,
  };

  const { data, error } = await supabase
    .from("sections")
    .insert(insertPayload)
    .select("id, name, level_id, created_at, is_active")
    .single<SectionRow>();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;

    if (code === "23505") {
      return formatError(400, "DUPLICATE_SECTION", "A section with this name already exists.", [
        { field: "name", message: "Section name must be unique within its level." },
      ]);
    }

    return formatError(
      500,
      "SECTION_CREATE_FAILED",
      "Unable to create section.",
      (error as { message?: string } | null)?.message ?? error
    );
  }

  const section = mapSectionRow(data);
  return formatSuccess<{ section: SectionDto }>({ section }, 201);
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateUpdateSectionBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid section update data.", errors);
  }

  const updatePayload: { name?: string; level_id?: string | null; is_active?: boolean } = {};

  if (typeof value.name === "string") {
    updatePayload.name = value.name;
  }

  if (typeof value.levelId !== "undefined") {
    updatePayload.level_id = value.levelId;
  }

  if (typeof value.isActive === "boolean") {
    updatePayload.is_active = value.isActive;
  }

  const { data, error } = await supabase
    .from("sections")
    .update(updatePayload)
    .eq("id", value.id)
    .select("id, name, level_id, created_at, is_active")
    .single<SectionRow>();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;

    if (code === "23505") {
      return formatError(400, "DUPLICATE_SECTION", "A section with this name already exists.", [
        { field: "name", message: "Section name must be unique within its level." },
      ]);
    }

    return formatError(
      500,
      "SECTION_UPDATE_FAILED",
      "Unable to update section.",
      (error as { message?: string } | null)?.message ?? error
    );
  }

  const section = mapSectionRow(data);
  return formatSuccess<{ section: SectionDto }>({ section });
}
