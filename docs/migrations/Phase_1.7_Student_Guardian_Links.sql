-- Phase 1.7 - Student Guardian Link Table
--
-- Purpose
-- -------
-- Establish a normalized mapping between SIS student records and authenticated app users
-- (parents/guardians or other delegates). This enables:
--   * Parent-facing event listings limited to their children
--   * Future registration workflows handled by staff on behalf of specific students
--   * Auditability of who is linked to each student record
--
-- Table Definition
-- ----------------
CREATE TABLE IF NOT EXISTS public.student_guardians (
    student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    app_user_id  UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    relationship TEXT,
    is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_by   UUID,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_by   UUID,
    CONSTRAINT student_guardians_pkey PRIMARY KEY (student_id, app_user_id)
);

COMMENT ON TABLE public.student_guardians IS
    'Links students to parent/guardian app users for role-scoped visibility and registrations.';

COMMENT ON COLUMN public.student_guardians.relationship IS
    'Free-form description (e.g., mother, father, adviser).';

COMMENT ON COLUMN public.student_guardians.is_primary IS
    'Marker for the primary guardian contact (at most one per student, enforced at application layer).';

COMMENT ON COLUMN public.student_guardians.created_by IS
    'App user who established the link (if available).';

-- Supporting indexes for common lookup patterns
CREATE INDEX IF NOT EXISTS idx_student_guardians_app_user_id
    ON public.student_guardians (app_user_id);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id
    ON public.student_guardians (student_id);

-- Optional: future RLS policies can reference this enable flag
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

-- Rollback
-- --------
-- DROP TABLE IF EXISTS public.student_guardians;


-- Allow service_role to fully manage app_users (bypass RLS for backend)
CREATE POLICY "Service role can manage app_users"
ON app_users
FOR ALL              -- or FOR INSERT, UPDATE if you prefer narrower
TO service_role
USING (true)
WITH CHECK (true);
