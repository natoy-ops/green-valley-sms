-- --------------------------------------------------------
-- Phase 1.8: Students Middle Name
-- Target: Supabase (PostgreSQL)
-- Adds an optional middle_name column to the students table
-- --------------------------------------------------------

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS middle_name text;

-- Notes:
-- - Column is nullable; application code (SIS import + UI) may treat it as optional.
-- - Existing rows will have NULL middle_name until populated.

-- Rollback
-- --------
-- To revert this change, run:
-- ALTER TABLE public.students DROP COLUMN IF EXISTS middle_name;
