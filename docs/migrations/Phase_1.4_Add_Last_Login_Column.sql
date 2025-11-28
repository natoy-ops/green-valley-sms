-- Phase 1.4 - Add last_login_at to app_users
-- --------------------------------------------------------
-- This migration adds a lightweight column for tracking the
-- last successful login time of each application user.
--
-- It is updated by the /api/auth/login route as a
-- best-effort metadata field and is used by the dashboard
-- to display the "Last Login" column.
-- --------------------------------------------------------

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMENT ON COLUMN app_users.last_login_at IS
  'Timestamp of last successful login (managed by /api/auth/login)';
