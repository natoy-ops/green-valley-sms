-- Phase 1.3: Event Scanner Assignments
-- Adds scanner assignment metadata so events can restrict who is allowed to scan.

alter table events
  add column if not exists scanner_assignments jsonb not null default '{"version":1,"scannerIds":[]}'::jsonb;

comment on column events.scanner_assignments is 'Versioned config describing which app users (scanners/admins) are authorized to scan attendees for the event.';
