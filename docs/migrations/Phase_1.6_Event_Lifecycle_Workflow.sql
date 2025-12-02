-- Phase 1.6 - Event Lifecycle, Visibility, and Registrations
--
-- This migration adds lifecycle and visibility fields to the public.events table
-- and introduces an event_registrations table to support future registration flows.

-----------------------------
-- 1. Enum Types
-----------------------------

-- Lifecycle status for events (approval workflow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'event_lifecycle_status'
  ) THEN
    CREATE TYPE public.event_lifecycle_status AS ENUM (
      'draft',
      'pending_approval',
      'approved',
      'published',
      'completed',
      'cancelled'
    );
  END IF;
END
$$;

-- Visibility for events (who can see the event in listings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'event_visibility'
  ) THEN
    CREATE TYPE public.event_visibility AS ENUM (
      'internal',
      'student',
      'public'
    );
  END IF;
END
$$;

-----------------------------
-- 2. Extend public.events
-----------------------------

ALTER TABLE public.events
  -- Approval/lifecycle workflow
  ADD COLUMN lifecycle_status public.event_lifecycle_status NOT NULL DEFAULT 'draft',
  ADD COLUMN owner_user_id uuid NULL,
  ADD COLUMN submitted_for_approval_at timestamptz NULL,
  ADD COLUMN approved_by uuid NULL,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN approval_comment text NULL,
  ADD COLUMN rejected_by uuid NULL,
  ADD COLUMN rejected_at timestamptz NULL,
  ADD COLUMN rejection_comment text NULL,
  ADD COLUMN published_at timestamptz NULL,
  ADD COLUMN completed_at timestamptz NULL,
  ADD COLUMN cancelled_by uuid NULL,
  ADD COLUMN cancelled_at timestamptz NULL,
  ADD COLUMN cancellation_reason text NULL,

  -- Visibility and basic registration metadata
  ADD COLUMN visibility public.event_visibility NOT NULL DEFAULT 'internal',
  ADD COLUMN registration_required boolean NOT NULL DEFAULT false,
  ADD COLUMN registration_opens_at timestamptz NULL,
  ADD COLUMN registration_closes_at timestamptz NULL,
  ADD COLUMN capacity_limit integer NULL;

-- Foreign key relationships for new user reference columns
ALTER TABLE public.events
  ADD CONSTRAINT events_owner_user_id_fkey
    FOREIGN KEY (owner_user_id)
    REFERENCES public.app_users (id),
  ADD CONSTRAINT events_approved_by_fkey
    FOREIGN KEY (approved_by)
    REFERENCES public.app_users (id),
  ADD CONSTRAINT events_rejected_by_fkey
    FOREIGN KEY (rejected_by)
    REFERENCES public.app_users (id),
  ADD CONSTRAINT events_cancelled_by_fkey
    FOREIGN KEY (cancelled_by)
    REFERENCES public.app_users (id);

-----------------------------
-- 3. event_registrations Table
-----------------------------

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id uuid NOT NULL
    REFERENCES public.events (id)
    ON DELETE CASCADE,

  student_id uuid NOT NULL
    REFERENCES public.students (id)
    ON DELETE CASCADE,

  -- User who performed the registration (admin/organizer/parent)
  registered_by_user_id uuid NULL
    REFERENCES public.app_users (id)
    ON DELETE SET NULL,

  registered_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
    REFERENCES public.app_users (id)
    ON DELETE SET NULL,

  updated_at timestamptz NULL,
  updated_by uuid NULL
    REFERENCES public.app_users (id)
    ON DELETE SET NULL
);

-- Prevent duplicate registrations for the same student and event
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_event_student_key
  UNIQUE (event_id, student_id);
