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

type LevelRow = {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
};

type SectionRow = {
  id: string;
  name: string;
  level_id: string | null;
  created_at: string;
  is_active: boolean;
};

type LevelDto = {
  id: string;
  name: string;
  isActive: boolean;
};

type SectionDto = {
  id: string;
  name: string;
  levelId: string | null;
  isActive: boolean;
};

function mapLevelRow(row: LevelRow): LevelDto {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
  };
}

function mapSectionRow(row: SectionRow): SectionDto {
  return {
    id: row.id,
    name: row.name,
    levelId: row.level_id,
    isActive: row.is_active,
  };
}

interface CreateLevelBody {
  name?: string;
}

function validateCreateLevelBody(body: unknown): {
  value?: { name: string };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawName = typeof data.name === "string" ? data.name.trim() : "";

  if (!rawName) {
    errors.push({ field: "name", message: "Level name is required." });
  } else if (rawName.length > 100) {
    errors.push({ field: "name", message: "Level name must be at most 100 characters." });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      name: rawName,
    },
  };
}

interface UpdateLevelBody {
  id?: string;
  name?: string;
  isActive?: boolean;
}

function validateUpdateLevelBody(body: unknown): {
  value?: { id: string; name?: string; isActive?: boolean };
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawId = typeof data.id === "string" ? data.id.trim() : "";
  const hasName = typeof data.name === "string";
  const rawName = hasName && typeof data.name === "string" ? data.name.trim() : "";
  const hasIsActive = typeof data.isActive === "boolean";
  const rawIsActive = hasIsActive ? (data.isActive as boolean) : undefined;

  if (!rawId) {
    errors.push({ field: "id", message: "Level id is required." });
  }

  if (hasName) {
    if (!rawName) {
      errors.push({ field: "name", message: "Level name is required." });
    } else if (rawName.length > 100) {
      errors.push({ field: "name", message: "Level name must be at most 100 characters." });
    }
  }

  if (!hasName && !hasIsActive) {
    errors.push({ field: "payload", message: "Nothing to update. Provide name or isActive." });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      id: rawId,
      ...(hasName ? { name: rawName } : {}),
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
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  let levelQuery = supabase
    .from("levels")
    .select("id, name, created_at, is_active")
    .order("name", { ascending: true });

  if (!includeInactive) {
    levelQuery = levelQuery.eq("is_active", true);
  }

  const { data: levelRows, error: levelsError } = await levelQuery;

  if (levelsError) {
    return formatError(
      500,
      "LEVEL_LIST_FAILED",
      "Unable to load levels.",
      levelsError.message ?? levelsError
    );
  }

  let sectionQuery = supabase
    .from("sections")
    .select("id, name, level_id, created_at, is_active")
    .order("name", { ascending: true });

  if (!includeInactive) {
    sectionQuery = sectionQuery.eq("is_active", true);
  }

  const { data: sectionRows, error: sectionsError } = await sectionQuery;

  if (sectionsError) {
    return formatError(
      500,
      "SECTION_LIST_FAILED",
      "Unable to load sections.",
      sectionsError.message ?? sectionsError
    );
  }

  const levels = (levelRows ?? []).map(mapLevelRow);
  const sections = (sectionRows ?? []).map(mapSectionRow);

  return formatSuccess<{ levels: LevelDto[]; sections: SectionDto[] }>({
    levels,
    sections,
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateCreateLevelBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid level data.", errors);
  }

  const insertPayload = {
    name: value.name,
  };

  const { data, error } = await supabase
    .from("levels")
    .insert(insertPayload)
    .select("id, name, created_at, is_active")
    .single<LevelRow>();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;

    if (code === "23505") {
      return formatError(400, "DUPLICATE_LEVEL", "A level with this name already exists.", [
        { field: "name", message: "Level name must be unique." },
      ]);
    }

    return formatError(
      500,
      "LEVEL_CREATE_FAILED",
      "Unable to create level.",
      (error as { message?: string } | null)?.message ?? error
    );
  }

  const level = mapLevelRow(data);
  return formatSuccess<{ level: LevelDto }>({ level }, 201);
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateUpdateLevelBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid level update data.", errors);
  }

  const updatePayload: { name?: string; is_active?: boolean } = {};

  if (typeof value.name === "string") {
    updatePayload.name = value.name;
  }

  if (typeof value.isActive === "boolean") {
    updatePayload.is_active = value.isActive;
  }

  const { data, error } = await supabase
    .from("levels")
    .update(updatePayload)
    .eq("id", value.id)
    .select("id, name, created_at, is_active")
    .single<LevelRow>();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;

    if (code === "23505") {
      return formatError(400, "DUPLICATE_LEVEL", "A level with this name already exists.", [
        { field: "name", message: "Level name must be unique." },
      ]);
    }

    return formatError(
      500,
      "LEVEL_UPDATE_FAILED",
      "Unable to update level.",
      (error as { message?: string } | null)?.message ?? error
    );
  }

  const level = mapLevelRow(data);
  return formatSuccess<{ level: LevelDto }>({ level });
}
