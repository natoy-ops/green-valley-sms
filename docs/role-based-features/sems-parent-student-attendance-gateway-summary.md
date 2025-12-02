# SEMS Parent & Student Attendance Gateway Summary

## Main Point

Create a parent and student "attendance gateway" experience where:
- Parents can see each child’s per-session event attendance (Morning In/Out, Afternoon In/Out, etc.) plus venue image on the parent events page.
- Students can see their own per-session scans on the student events page.
- Both views clearly indicate that scan data is **not real time** and appears only after scanners submit their data.

## Key Changes

- **Parent Events API (`/api/sems/events/parent`)**
  - Enriched the response to include, per event:
    - `facilityImageUrl` from the linked facility’s `image_url`.
    - `children[]` for the authenticated parent, each with:
      - `studentId`, `fullName`, `gradeLevel`, `section`.
      - `sessions[]` describing every configured event session with:
        - `sessionId`, `period` (morning/afternoon/evening), `direction` (in/out).
        - `scheduledOpens`, `scheduledCloses`.
        - `scannedAt` and `status` (`none`, `present`, `late`).
  - Uses `event_sessions` and `attendance_logs` filtered to the parent’s linked students via `student_guardians`.

- **Parent Events UI (`/sems/parent-events`)**
  - Extended `ParentEventListItem` to include `facilityImageUrl` and `children` with per-session data.
  - Updated event cards to:
    - Show the venue image thumbnail on the right side of the header.
    - Render a child-centric attendance block:
      - One section per child with name + grade/section.
      - One row per configured session labeled like `Morning In`, `Morning Out`, `Afternoon In`, etc.
      - Each row shows `No scan` or `Present/Late • HH:MM AM/PM` based on attendance logs.

- **Student Events API (`/api/sems/events/student`)**
  - Enriched the response to include, per event, `mySessions[]` for the logged-in student only.
  - For each configured session:
    - Derives `period` and `direction` from `session_type`.
    - Attaches `scheduledOpens`, `scheduledCloses`.
    - Looks up the student’s `attendance_logs` to set `scannedAt` and `status` (`none`, `present`, `late`).

- **Student Events UI (`/sems/student-events`)**
  - Extended `StudentEventListItem` to include `mySessions` (per-session scan data for the logged-in student).
  - Under the existing attendance bar, added:
    - A clear disclaimer: *"Scan data is not real time. Your scans will appear here after the scanner submits its data."*
    - A list of sessions for that student, sorted by period and direction, each row showing:
      - Label: `Morning In`, `Morning Out`, `Afternoon In`, etc.
      - Status: `No scan` or `Present/Late • HH:MM AM/PM`.

## Notes

- Existing event list behavior (filtering, pagination, status badges, audience summaries) was preserved.
- The same session-type mapping logic (from `session_type` to period/direction) is reused conceptually across parent and student views.
- All attendance information is **read-only** and depends on scanner devices submitting `attendance_logs` to Supabase.

---

## Social Media Sharing Support

### Overview

Added support for social media sharing by introducing a poster image field for events. The existing description field is now explicitly noted as being used for social media post captions.

### Database Changes

**Migration: `Phase_1.9_Event_Social_Media.sql`**
- Added `poster_image_url` (text, nullable) column to `events` table
- Updated comment on `description` column to note its dual-use for social media sharing

### Backend Changes

- **Domain Types** (`types.ts`):
  - Added `poster_image_url` to `EventRow`
  - Added `posterImageUrl` to `CreateEventDto`, `UpdateEventDto`, and `EventDto`

- **EventRepository** (`event.repository.ts`):
  - Added `poster_image_url` to all SELECT statements
  - Added handling in `create()` and `update()` methods

- **API Route** (`route.ts`):
  - Added parsing for `posterImageUrl` in both POST and PUT handlers

### Frontend Changes

- **Create/Edit Event Dialog** (`sems/page.tsx`):
  - Added state: `createEventDescription`, `createEventPosterUrl`
  - Added **Event Description** textarea with hint about social media usage
  - Added **Event Poster Image** URL input with:
    - Live image preview
    - Error handling for broken image URLs
    - Helper text explaining the purpose
  - Updated `resetForm()` to clear new fields
  - Updated `openEditDialog()` to load existing description and poster URL
  - Updated form submission payload to include new fields

### Usage

When creating/editing an event:
1. Enter an **Event Description** that reads well as a social media post caption
2. Provide an **Event Poster Image** URL for the banner/poster image
3. The preview shows how the image will appear

These fields will be available for the Parent and Student event pages to display and enable social media sharing functionality in a future update.
