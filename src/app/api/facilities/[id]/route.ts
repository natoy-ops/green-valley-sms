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

type FacilityStatus = "operational" | "maintenance" | "out_of_service" | "retired";

interface FacilityRow {
  id: string;
  name: string;
  type: string;
  location_identifier: string;
  image_url: string | null;
  capacity: number | null;
  status: FacilityStatus;
  created_by: string | null;
  created_at: string;
}

interface FacilityDto {
  id: string;
  name: string;
  type: string;
  location: string;
  imageUrl: string | null;
  capacity: number | null;
  status: FacilityStatus;
  createdAt: string;
}

function mapFacilityRow(row: FacilityRow): FacilityDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location_identifier,
    imageUrl: row.image_url,
    capacity: row.capacity,
    status: row.status,
    createdAt: row.created_at,
  };
}

interface UpdateFacilityBody {
  name?: string;
  type?: string;
  location?: string;
  imageUrl?: string;
  capacity?: number | null;
  status?: FacilityStatus;
}

function validateUpdateFacilityBody(body: unknown): {
  value?: Required<Pick<UpdateFacilityBody, "name" | "type" | "location" >> & UpdateFacilityBody;
  errors?: { field: string; message: string }[];
} {
  const errors: { field: string; message: string }[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  const rawName = typeof data.name === "string" ? data.name.trim() : "";
  const rawType = typeof data.type === "string" ? data.type.trim() : "";
  const rawLocation = typeof data.location === "string" ? data.location.trim() : "";
  const rawImageUrl = typeof data.imageUrl === "string" ? data.imageUrl.trim() : "";

  if (!rawName) {
    errors.push({ field: "name", message: "Facility name is required." });
  }
  if (!rawType) {
    errors.push({ field: "type", message: "Facility type is required." });
  }
  if (!rawLocation) {
    errors.push({ field: "location", message: "Location / Identifier is required." });
  }

  let capacity: number | null = null;
  if (data.capacity != null) {
    const numeric = typeof data.capacity === "number" ? data.capacity : Number(data.capacity as unknown as string);
    if (Number.isNaN(numeric) || numeric < 0) {
      errors.push({ field: "capacity", message: "Capacity must be a non-negative number." });
    } else {
      capacity = numeric;
    }
  }

  let status: FacilityStatus = "operational";
  if (typeof data.status === "string") {
    if (["operational", "maintenance", "out_of_service", "retired"].includes(data.status)) {
      status = data.status as FacilityStatus;
    } else {
      errors.push({ field: "status", message: "Invalid facility status." });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      name: rawName,
      type: rawType,
      location: rawLocation,
      imageUrl: rawImageUrl || "",
      capacity,
      status,
    },
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return formatError(400, "INVALID_ID", "Facility ID is required.");
  }

  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const body = await request.json().catch(() => null);
  const { value, errors } = validateUpdateFacilityBody(body);

  if (!value || errors) {
    return formatError(400, "VALIDATION_ERROR", "Invalid facility data.", errors);
  }

  const updatePayload = {
    name: value.name,
    type: value.type,
    location_identifier: value.location,
    image_url: value.imageUrl || null,
    capacity: value.capacity,
    status: value.status,
  };

  const { data, error } = await supabase
    .from("facilities")
    .update(updatePayload)
    .eq("id", id)
    .select("id, name, type, location_identifier, image_url, capacity, status, created_by, created_at");

  if (error) {
    console.error("[/api/facilities/", id, "] Failed to update facility", {
      error,
    });
    return formatError(500, "FACILITY_UPDATE_FAILED", "Unable to update facility.", error.message ?? error);
  }

  const rows = (data ?? []) as FacilityRow[];

  if (!rows.length) {
    return formatError(404, "FACILITY_NOT_FOUND", "Facility not found.");
  }

  const facility = mapFacilityRow(rows[0]);
  return formatSuccess({ facility });
}
