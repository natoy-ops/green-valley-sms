-- Phase 1.5 - RLS: Allow authenticated users to write to app_users
-- --------------------------------------------------------
-- This migration adds row-level security policies so that
-- Supabase `authenticated` users can insert/update their
-- own record in `app_users`.
--
-- NOTE:
-- - Service role operations (like your Next.js backend using
--   SUPABASE_SERVICE_ROLE_KEY) bypass RLS and are unaffected.
-- - These policies only affect clients using anon keys or
--   auth sessions where `auth.role() = 'authenticated'`.
-- --------------------------------------------------------

-- Ensure RLS is enabled (no-op if already done in Phase 1.2)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own row
CREATE POLICY "Authenticated users can insert own app_user row"
ON app_users
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = id
);

-- Allow authenticated users to update their own row
CREATE POLICY "Authenticated users can update own app_user row"
ON app_users
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'authenticated'
  AND auth.uid() = id
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND auth.uid() = id
);

-- Allow authenticated users to read attendance logs (for dashboards/reporting)
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attendance logs"
ON attendance_logs
FOR SELECT
TO authenticated
USING (true);
