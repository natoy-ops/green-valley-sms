-- --------------------------------------------------------
-- Phase 1.1: Create Event Flow & Audit Columns
-- Target: Supabase (PostgreSQL)
-- This migration is intended to be applied AFTER Phase_1_Database_Schema.sql
-- --------------------------------------------------------

-- 1. EVENTS: Support date range + updated audience JSON model

-- Add optional start/end dates for events to align with Create Event UI
alter table events
  add column if not exists start_date date,
  add column if not exists end_date date;

-- Relax single-date requirement to allow either legacy single date or new range model
alter table events
  alter column event_date drop not null;

-- Align default audience JSON with versioned EventAudienceConfig model
alter table events
  alter column target_audience set default '{"version": 1, "rules": []}'::jsonb;

-- Add facility reference for venue selection
alter table events
  add column if not exists facility_id uuid references facilities(id) on delete set null;

-- Add session_config JSON for versioned per-date session configuration
alter table events
  add column if not exists session_config jsonb default '{"version": 2, "dates": []}'::jsonb;


-- 2. AUDIT COLUMNS: created_by / updated_by / updated_at
-- Pattern: created_by + created_at (existing in some tables), plus updated_by + updated_at everywhere
-- All audit columns are nullable; application code should enforce and populate them.

-- 2.1 PROFILES
alter table profiles
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.2 STUDENTS
alter table students
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.3 LEVELS
alter table levels
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.4 SECTIONS
alter table sections
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.5 FACILITIES (already has created_by + created_at)
alter table facilities
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.6 EVENTS (already has created_by + created_at)
alter table events
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.7 EVENT SESSIONS
alter table event_sessions
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;

-- 2.8 ATTENDANCE LOGS
alter table attendance_logs
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;


CREATE POLICY "Staff can view events" ON events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can insert events" ON events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff can update events" ON events FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff can delete events" ON events FOR DELETE USING (auth.role() = 'authenticated');