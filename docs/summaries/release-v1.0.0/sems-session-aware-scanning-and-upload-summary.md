# SEMS Session-Aware Scanning & Upload Summary

## Main Goal
Make the SEMS scanner truly **session-aware** and **end-to-end synced** so that:
- The phone automatically decides which session a scan belongs to based on **device date/time** and the event's **session_config**.
- Each student can scan **once per session**, with correct **PRESENT/LATE/DENIED/DUPLICATE** logic.
- Valid scans are uploaded to Supabase and reflected in the **Attendance** column on `/sems/scan`.

---

## Key Changes

### 1. Session-Aware Scanning Logic

**File:** `src/core/offline/scanner-session-utils.ts`

- Added utilities to centralize time/session logic:
  - `getCurrentDateString()` / `getCurrentTimeString()` – use device local time.
  - `parseTimeToMinutes()` – internal helper for time comparison.
  - `formatTimeFriendly()` – converts `HH:mm` to user‑friendly format like `9 PM`.
  - `findActiveSession(sessionConfig)` – core session detection:
    - Looks up today's date in `sessionConfig.dates`.
    - Finds session where `opens <= now <= closes`.
    - Returns:
      - **Active** session if within a window.
      - Otherwise, friendly reasons like:
        - `"Can't scan right now. Evening Out starts at 9 PM."` (next session later today)
        - `"Scanning is done for today."` (all sessions finished)
        - `"No scanning scheduled for today."`
        - `"This event doesn't have scanning sessions set up yet."`
  - `isLateForSession(session)` – marks a scan as late if:
    - `direction === "in"`, and
    - `lateAfter` is set, and
    - current time is **after** `lateAfter`.

This matches the desired behavior: e.g., Evening In vs Evening Out, on-time vs late windows, and device-time based decisions.

---

### 2. Scanner Page: Per-Session Scan Logic

**File:** `src/app/(dashboard)/sems/scan/[eventId]/page.tsx`

Updated `processScan` to be fully session-aware:

- **Active session detection**
  - Loads the cached event from IndexedDB (`scannerDb.scannerEvents`).
  - Calls `findActiveSession(currentEventRecord.sessionConfig)`.
  - If no active session:
    - `scanStatus = "DENIED"`.
    - Shows friendly reason from `findActiveSession` (e.g., "Can't scan right now. Evening Out starts at 9 PM.").

- **Student lookup**
  - Looks up in `allowedStudents` by `[eventId+qrHash]`.
  - If not found:
    - `scanStatus = "DENIED"`.
    - Message: `"This student is not registered for this event."`.

- **Per-session duplicate detection**
  - Uses new compound index `[eventId+sessionId+studentId]` in `scanQueue`.
  - If a row exists for that tuple:
    - `scanStatus = "DUPLICATE"`.
    - Message: `"Already scanned for Evening In"` (session name aware).

- **PRESENT vs LATE**
  - If not duplicate and student allowed:
    - Calls `isLateForSession(activeSession)`.
    - `scanStatus = "LATE"` or `"PRESENT"` accordingly.

- **Scan queue record**
  - Every scan (even denied/duplicate) is stored in IndexedDB with:
    - `status`, `reason`.
    - `sessionId`, `sessionName`, `sessionDirection`.
    - `syncStatus: "pending"`.

- **Friendly UI messages**
  - If `reason` is set (e.g. closed window, not registered), UI shows that directly.
  - Otherwise builds short messages:
    - `"On time for Evening In"`
    - `"Late for Evening In"`
    - `"Already scanned for Evening In"`
    - Fallback: `"Can't scan this student."`
  - If scanner resources are missing:
    - Message: `"Please download event data first."`.

---

### 3. IndexedDB Schema: Session-Aware Scan Queue

**File:** `src/core/offline/scanner-db.ts`

- Bumped `Dexie` schema to **version 2**.
- `scanQueue` now includes:
  - `sessionId`.
  - Compound index `[eventId+sessionId+studentId]` for per-session duplicates.
- Keeps backward-compatible version 1 definition for migrations.

This allows the scanner to enforce "one scan per student per session" on the device.

---

### 4. Download Scanner Resources (Server → Device)

**File:** `src/app/api/sems/events/[id]/scanner-resources/route.ts`

- API to download students + event session config for an event.
- Respects audience rules (`EventAudienceConfig`).
- Returns:
  - `event`: basic info + `sessionConfig`.
  - `students`: only allowed students with section/level info + `qrHash`.

**File:** `src/app/(dashboard)/sems/scan/page.tsx` (scanner events list)

- `handleDownloadEventData`:
  - Calls `/api/sems/events/[id]/scanner-resources`.
  - Stores event in `scannerEvents` with `sessionConfig`.
  - Clears + rebuilds `allowedStudents` for that event.
  - Shows toast like: `"Scanner data downloaded – 120 students cached for Test Event."`.

---

### 5. Upload Scans (Device → Server)

#### Backend Endpoint

**File:** `src/app/api/sems/events/[id]/scans/route.ts`

- **Auth + authorization**
  - Validates bearer/cookie token with Supabase Admin client.
  - Ensures user is assigned as scanner for the event (via `scanner_assignments.scannerIds`).

- **Input shape**
  - Accepts `POST` body:
    ```ts
    interface ScanUploadRecord {
      id: string;
      studentId: string;
      qrHash: string;
      scannedAt: string; // ISO
      status: "PRESENT" | "LATE" | "DENIED" | "DUPLICATE";
      reason: string | null;
      sessionId: string | null;
      sessionName: string | null;
      sessionDirection: "in" | "out" | null;
      sessionPeriod?: string | null;
      sessionOpens?: string | null;
      sessionCloses?: string | null;
      sessionLateAfter?: string | null;
    }
    ```

- **Filtering**
  - Only **valid attendance** is uploaded:
    - `status` is `PRESENT` or `LATE`.
    - `studentId` and `sessionId` present.
  - Skips `DENIED` and `DUPLICATE` scans and incomplete rows.
  - Response includes counts: `uploaded`, `duplicates`, `skipped`, `errors`.

- **event_sessions mapping**
  - For each distinct `sessionId` from the client:
    - Maps to an `event_sessions` row for that event by `name`.
    - Creates one if needed using supplied `opens`, `closes`, `lateAfter`.
    - Maps logical session (e.g. `evening-in`) to DB `session_type` (e.g. `evening_in`).

- **attendance_logs insert**
  - Inserts one row per valid scan:
    - `event_session_id`, `student_id`, `scanned_at`, `status`, `synced_by_user_id`.
  - Handles duplicates via DB unique constraint `(event_session_id, student_id)`:
    - Counts as `duplicates` without crashing the upload.
  - Returns list of `uploadedScanIds` that were successfully stored.

#### Frontend Upload Flow

**File:** `src/app/(dashboard)/sems/scan/page.tsx`

- `handleUploadEventData` wired to **"Upload data"** menu item.
- Steps:
  1. Reads `scanQueue` for the selected event where `syncStatus === "pending"`.
  2. Builds a `sessionMap` from cached `sessionConfig` to enrich each scan with:
     - `sessionPeriod`, `sessionOpens`, `sessionCloses`, `sessionLateAfter`.
  3. Sends `POST /api/sems/events/[id]/scans` with `{ scans: enrichedScans }`.
  4. Processes response:
     - Marks `uploadedScanIds` in IndexedDB as `syncStatus: "synced"`.
     - Shows toast: `"Scans uploaded – 3 uploaded, 0 duplicates, 40 skipped."`.
  5. Calls `loadEvents()` again so `/sems/scan` refreshes the **Attendance** column.

- **Meaning of "skipped"**
  - `skipped = total local scans - valid attendance scans`.
  - Typically includes:
    - DENIED scans (wrong time / not registered / session closed).
    - DUPLICATE scans for the same session.
    - Any scan without `studentId` or `sessionId`.

---

### 6. Attendance Column Now Reflects Uploads

**File:** `src/modules/sems/infrastructure/event.repository.ts`

- `countEventAttendees(eventId)` originally used a Supabase `count` with `head: true`.
- To make sure counts are correct and simple, it was changed to:
  - Fetch all `attendance_logs.student_id` for the event's `event_sessions`.
  - Use a JS `Set` to count **unique** students.
- This value becomes `actualAttendees` in `EventListItemDto` and is displayed as `Attendance` on `/sems/scan`.

Result: After uploading from the device, the **Test Event** now shows the correct attendance (e.g. `3 / 6`).

---

## How to Re-Test End-to-End

1. **Prepare**
   - Clear browser IndexedDB (`semsScanner` DB) if needed.
   - Go to `/sems/scan` and download data for the test event.

2. **Scan**
   - Open `/sems/scan/[eventId]`.
   - Scan students during the configured session windows.
   - Confirm UI messages (on time, late, duplicate, closed window) are clear and simple.

3. **Upload**
   - Return to `/sems/scan` list.
   - Use the `...` menu → **Upload data** for that event.
   - Expect toast like: `Scans uploaded – X uploaded, Y duplicates, Z skipped.`

4. **Verify server data**
   - Reload `/sems/scan`.
   - Check `Attendance` column is updated using server counts.

This completes the session-aware scanner implementation and end-to-end upload flow for SEMS.
