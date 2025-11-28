import { NextRequest } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import {
  fetchCurrentAppUser,
  formatError,
  formatSuccess,
} from "../profile-utils";

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

function validatePassword(password?: string) {
  if (!password) {
    return "Password is required.";
  }
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasUpper || !hasLower || !hasNumber) {
    return "Password must include upper, lower, and numeric characters.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authResult = await fetchCurrentAppUser(request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();
  const { supabaseUser, appUser } = authResult;

  const body = (await request.json().catch(() => null)) as ChangePasswordBody | null;
  const currentPassword = body?.currentPassword?.trim();
  const newPassword = body?.newPassword?.trim();

  if (!currentPassword) {
    return formatError(400, "VALIDATION_ERROR", "Current password is required.");
  }

  const validationError = validatePassword(newPassword);
  if (validationError) {
    return formatError(400, "VALIDATION_ERROR", validationError);
  }

  const emailToVerify = supabaseUser.email ?? appUser.email;
  if (!emailToVerify) {
    return formatError(400, "ACCOUNT_EMAIL_MISSING", "Account email is missing.");
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: emailToVerify,
    password: currentPassword,
  });

  if (authError || !authData?.user) {
    return formatError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(appUser.id, {
    password: newPassword!,
  });

  if (updateError) {
    return formatError(
      500,
      "PASSWORD_UPDATE_FAILED",
      "Unable to update password right now.",
      updateError.message ?? updateError
    );
  }

  return formatSuccess({ success: true });
}
