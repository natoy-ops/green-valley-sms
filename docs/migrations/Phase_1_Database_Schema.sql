-- --------------------------------------------------------
-- Phase 1: Core Identity & Event Management Schema
-- Target: Supabase (PostgreSQL)
-- --------------------------------------------------------

-- 1. ENUMS (For consistent status tracking)
create type user_role as enum ('super_admin', 'admin', 'scanner');
create type attendance_status as enum ('present', 'late', 'absent');
create type session_type as enum ('morning_in', 'morning_out', 'afternoon_in', 'afternoon_out', 'evening_in', 'evening_out');
create type facility_status as enum ('operational', 'maintenance', 'out_of_service', 'retired');

-- 2. PROFILES (Extends Supabase Auth)
-- This table links to auth.users to store app-specific user data
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role user_role default 'scanner',
  created_at timestamp with time zone default now()
);

-- 3. STUDENTS (The Core Registry)
create table students (
  id uuid default gen_random_uuid() primary key,
  student_school_id text unique not null,
  first_name text not null,
  last_name text not null,
  section_id uuid references sections(id) on delete restrict,
  guardian_phone text,
  guardian_email text,
  qr_hash text unique not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table levels (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table sections (
  id uuid default gen_random_uuid() primary key,
  level_id uuid references levels(id) on delete cascade,
  name text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  unique(level_id, name)
);

-- 4. FACILITIES (Facilities Registry)
create table facilities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  location_identifier text not null,
  image_url text,
  capacity integer,
  status facility_status default 'operational',
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- 5. EVENTS (Event Master)
create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  event_date date not null,
  -- JSON rule for who can attend (e.g., {"grade": ["10", "11"]})
  target_audience jsonb default '{"grade": "all"}', 
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- 6. EVENT SESSIONS (Time Logic)
-- Defines specific scan windows within an event
create table event_sessions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null, -- e.g., "Morning Entry"
  session_type session_type not null,
  start_time time not null,
  late_threshold_time time, -- After this time, status is 'late'
  end_time time not null,
  created_at timestamp with time zone default now()
);

-- 7. ATTENDANCE LOGS (The Big Data)
-- Stores the actual scan records
create table attendance_logs (
  id uuid default gen_random_uuid() primary key,
  event_session_id uuid references event_sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  scanned_at timestamp with time zone not null,
  status attendance_status not null,
  scanned_by_device_id text, -- Optional: tracks which phone scanned it
  synced_by_user_id uuid references profiles(id), -- Who performed the bulk sync
  created_at timestamp with time zone default now(),
  
  -- Constraint: A student can only scan ONCE per session
  unique(event_session_id, student_id)
);

-- 8. Row Level Security (RLS) - Basic Setup
alter table profiles enable row level security;
alter table students enable row level security;
alter table events enable row level security;
alter table attendance_logs enable row level security;
alter table facilities enable row level security;

-- Policies (Simplified for Phase 1 Start)
-- Allow authenticated users to view profiles
create policy "Public profiles are viewable by everyone" 
on profiles for select using ( true );

-- Allow admins/scanners to read student data for scanning
create policy "Staff can view students" 
on students for select using ( auth.role() = 'authenticated' );

-- Allow staff to insert attendance logs
create policy "Staff can insert logs" 
on attendance_logs for insert with check ( auth.role() = 'authenticated' );

create policy "Staff can view facilities" 
on facilities for select using ( auth.role() = 'authenticated' );

create policy "Staff can insert facilities" 
on facilities for insert with check ( auth.role() = 'authenticated' );

create policy "Staff can update facilities" 
on facilities for update using ( auth.role() = 'authenticated' ) with check ( auth.role() = 'authenticated' );

create policy "Staff can delete facilities" 
on facilities for delete using ( auth.role() = 'authenticated' );