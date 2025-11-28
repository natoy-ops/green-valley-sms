-- --------------------------------------------------------
-- Phase 1.2: Merge profiles + sis_users → app_users
-- Target: Supabase (PostgreSQL)
-- This migration is intended to be applied AFTER Phase_1.1
-- --------------------------------------------------------
--
-- GOAL: Create a single canonical user table `app_users` that:
--   1. Extends auth.users (PK = auth.users.id)
--   2. Contains RBAC fields (roles, primary_role, is_active, school_id)
--   3. Replaces `profiles` as the FK target for audit columns
--
-- IMPORTANT: Run this migration BEFORE you have production data,
-- or adapt the data migration steps as needed.
-- --------------------------------------------------------


-- --------------------------------------------------------
-- STEP 1: Create user_role type if not exists (expanded)
-- --------------------------------------------------------
-- Drop old enum if it only has limited values
DO $$
BEGIN
  -- Check if we need to add new values to user_role enum
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'teacher' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'staff' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'parent' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'parent';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- user_role type doesn't exist yet, will be created with app_users
    NULL;
END $$;


-- --------------------------------------------------------
-- STEP 2: Create app_users table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
  -- Primary key links to Supabase auth.users
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identity
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  
  -- RBAC
  roles text[] NOT NULL DEFAULT '{}',
  primary_role text NOT NULL DEFAULT 'staff',
  
  -- Account status
  is_active boolean NOT NULL DEFAULT true,
  
  -- Multi-tenant support (nullable for single-school deployments)
  school_id uuid NULL,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  
  -- Audit (self-referencing; nullable because first user has no creator)
  created_by uuid REFERENCES app_users(id),
  updated_by uuid REFERENCES app_users(id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON app_users(is_active);
CREATE INDEX IF NOT EXISTS idx_app_users_primary_role ON app_users(primary_role);


-- --------------------------------------------------------
-- STEP 3: Migrate existing data (if any)
-- --------------------------------------------------------

-- 3a. Migrate from sis_users (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sis_users') THEN
    INSERT INTO app_users (id, email, full_name, roles, primary_role, is_active, school_id, created_at)
    SELECT 
      id,
      email,
      COALESCE(full_name, email),
      COALESCE(roles, ARRAY['staff']),
      COALESCE(primary_role, 'staff'),
      COALESCE(is_active, true),
      school_id,
      COALESCE(created_at, now())
    FROM sis_users
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3b. Migrate from profiles (if it exists and has data not in app_users)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    -- Get email from auth.users for profiles that don't have it
    INSERT INTO app_users (id, email, full_name, roles, primary_role, is_active, created_at)
    SELECT 
      p.id,
      COALESCE(au.email, 'unknown@unknown.com'),
      COALESCE(p.full_name, au.email, 'Unknown'),
      ARRAY[COALESCE(p.role::text, 'staff')],
      COALESCE(p.role::text, 'staff'),
      true,
      COALESCE(p.created_at, now())
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE app_users.id = p.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;


-- --------------------------------------------------------
-- STEP 4: Update foreign key references
-- --------------------------------------------------------

-- 4a. facilities.created_by → app_users
DO $$
BEGIN
  -- Drop old FK if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'facilities_created_by_fkey' 
    AND table_name = 'facilities'
  ) THEN
    ALTER TABLE facilities DROP CONSTRAINT facilities_created_by_fkey;
  END IF;
  
  -- Add new FK
  ALTER TABLE facilities 
    ADD CONSTRAINT facilities_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- 4b. facilities.updated_by → app_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'facilities_updated_by_fkey' 
    AND table_name = 'facilities'
  ) THEN
    ALTER TABLE facilities DROP CONSTRAINT facilities_updated_by_fkey;
  END IF;
  
  ALTER TABLE facilities 
    ADD CONSTRAINT facilities_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- 4c. events.created_by → app_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'events_created_by_fkey' 
    AND table_name = 'events'
  ) THEN
    ALTER TABLE events DROP CONSTRAINT events_created_by_fkey;
  END IF;
  
  ALTER TABLE events 
    ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- 4d. events.updated_by → app_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'events_updated_by_fkey' 
    AND table_name = 'events'
  ) THEN
    ALTER TABLE events DROP CONSTRAINT events_updated_by_fkey;
  END IF;
  
  ALTER TABLE events 
    ADD CONSTRAINT events_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- 4e. attendance_logs.synced_by_user_id → app_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'attendance_logs_synced_by_user_id_fkey' 
    AND table_name = 'attendance_logs'
  ) THEN
    ALTER TABLE attendance_logs DROP CONSTRAINT attendance_logs_synced_by_user_id_fkey;
  END IF;
  
  ALTER TABLE attendance_logs 
    ADD CONSTRAINT attendance_logs_synced_by_user_id_fkey 
    FOREIGN KEY (synced_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- 4f. Update other tables with created_by/updated_by (students, levels, sections, event_sessions)
DO $$
DECLARE
  tbl text;
  col text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['students', 'levels', 'sections', 'event_sessions', 'attendance_logs']) LOOP
    FOR col IN SELECT unnest(ARRAY['created_by', 'updated_by']) LOOP
      BEGIN
        -- Drop old FK
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_' || col || '_fkey');
        -- Add new FK
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES app_users(id) ON DELETE SET NULL', tbl, tbl || '_' || col || '_fkey', col);
      EXCEPTION
        WHEN undefined_table THEN NULL;
        WHEN undefined_column THEN NULL;
      END;
    END LOOP;
  END LOOP;
END $$;


-- --------------------------------------------------------
-- STEP 5: Enable RLS on app_users
-- --------------------------------------------------------
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view app_users (for display names, etc.)
CREATE POLICY "Authenticated users can view app_users" 
ON app_users FOR SELECT 
USING (auth.role() = 'authenticated');


-- --------------------------------------------------------
-- STEP 6: Drop old tables (ONLY after verifying migration)
-- --------------------------------------------------------
-- IMPORTANT: Uncomment these ONLY after you've verified data migrated correctly!

-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS sis_users CASCADE;


-- --------------------------------------------------------
-- STEP 7: Create helper function for user lookup
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_app_user()
RETURNS app_users
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM app_users WHERE id = auth.uid();
$$;
