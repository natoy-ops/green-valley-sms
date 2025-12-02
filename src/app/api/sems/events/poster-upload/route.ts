import { NextRequest } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { ADMIN_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";
import { formatError, formatSuccess } from "../utils";

export const runtime = "nodejs";

const BUCKET_NAME = "event-posters";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return formatError(400, "INVALID_FORM_DATA", "Unable to read upload form data.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return formatError(400, "NO_FILE", "No image file was uploaded.");
  }

  if (!file.type || !file.type.startsWith("image/")) {
    return formatError(400, "INVALID_TYPE", "Only image files are allowed for event posters.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return formatError(400, "FILE_TOO_LARGE", "Poster image must be 5 MB or smaller.");
  }

  const supabase = getAdminSupabaseClient();

  const extensionFromType = file.type.split("/")[1] || "jpg";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const path = `posters/${timestamp}-${randomSuffix}.${extensionFromType}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("[POST /api/sems/events/poster-upload] Upload error:", uploadError);
    return formatError(
      500,
      "UPLOAD_FAILED",
      "Unable to upload poster image.",
      uploadError.message ?? uploadError
    );
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  return formatSuccess({ url: publicUrl, path }, 201);
}
