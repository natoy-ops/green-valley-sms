# SEMS Offline Scanner Implementation Summary

## Overview

This chat finalized the first end-to-end version of the **SEMS Scanner** that supports fast, offline-friendly QR code scanning backed by Supabase + Dexie (IndexedDB). The design follows the "local-first, sync-later" architecture defined in the SEMS execution plan.

## Key Decisions

- **Local-first architecture**
  - Scanner requires network for **login** and **downloading resources**.
  - Actual **scanning and matching** runs fully offline via IndexedDB.

- **Data model for offline scanning (Dexie)**
  - Created `src/core/offline/scanner-db.ts` with three tables:
    - `scannerEvents`
      - Stores per-event metadata and `sessionConfig` (for time-based rules).
      - Fields: `id`, `title`, `venue`, `timeRange`, `startDate`, `endDate`, `sessionConfig`, `scannerUserId`, `downloadedAt`.
    - `allowedStudents`
      - Stores allowed list per event.
      - Fields: `eventId`, `studentId`, `qrHash`, `fullName`, `lrn`, `grade`, `section`.
      - Indexes: `[eventId+qrHash]`, `[eventId+studentId]` for fast lookup.
    - `scanQueue`
      - Stores local scans to be synced later.
      - Fields: `eventId`, `studentId`, `qrHash`, `scannedAt`, `status`, `reason`, `sessionId`, `sessionName`, `sessionDirection`, `syncStatus`, `createdAt`.
      - `status` is a `ScanStatus` union: `"PRESENT" | "LATE" | "DENIED" | "DUPLICATE"`.

- **Per-event scanner resources API**
  - Added `GET /api/sems/events/[id]/scanner-resources`:
    - Authenticates current user via access token/cookie.
    - Ensures the caller is assigned as scanner for the event (via `scannerConfig.scannerIds`).
    - Fetches the event with facility and full `sessionConfig`.
    - Fetches all active students with their `qr_hash`, section and level.
    - Returns payload:
      - `event`: `{ id, title, startDate, endDate, facilityName, audienceConfig, sessionConfig }`.
      - `students`: `{ id, fullName, lrn, levelId, levelName, sectionId, sectionName, qrHash }[]`.

- **Download data action (scanner events list)**
  - On `/sems/scan` (**ScannerEventsPage**), the table now has an **Actions** column with a `...` menu.
  - "Download data" action:
    - Calls `/api/sems/events/{eventId}/scanner-resources`.
    - Runs a Dexie transaction:
      - Upserts `scannerEvents` entry for the event.
      - Clears existing `allowedStudents` for that event.
      - Bulk inserts `allowedStudents` rows mapped from API students.
    - Shows success/error toasts via `sonner`.

- **Scanner detail page wired to Dexie**
  - `/sems/scan/[eventId]` now:
    - Loads `scannerEvents` + `allowedStudents` from Dexie.
    - Shows **"Scanner resources missing"** state when nothing is cached.
    - Uses real event `title` and `venue` in the header when resources exist.

- **Real scan state and stats (Dexie-driven)**
  - Defined `ScannedStudent` UI model to drive the bottom card.
  - Introduced `scanStats` state:
    - `totalScanned`, `totalLate`, `totalDenied`, `totalDuplicates`.
  - Computing `remainingAllowed = max(allowedStudentCount - totalScanned, 0)`.
  - `processScan(qrHash: string)` pipeline:
    1. Look up `AllowedStudentRecord` by `[eventId+qrHash]` in Dexie.
    2. If missing → `status = DENIED` with reason.
    3. If present, check `scanQueue` for duplicate by `eventId + studentId`.
       - If found → `status = DUPLICATE`.
       - Else → `status = PRESENT` for now (time logic to follow).
    4. Insert into `scanQueue` with status, reason, timestamps.
    5. Derive `lastScan` view model and update `scanStats` via a `switch` on `ScanStatus`.

- **Manual QR input for testing**
  - Added a developer-only control on `[eventId]` page:
    - Text input for QR hash (`qr_...`).
    - "Scan" button that calls `processScan`.
    - Uses the same pipeline as camera-based scanning.

- **Camera-based scanning with BarcodeDetector**
  - No external QR library is used due to React 19 peer-dependency conflicts.
  - Integration details:
    - Uses `navigator.mediaDevices.getUserMedia` to request the rear camera.
    - Uses `window.BarcodeDetector({ formats: ["qr_code"] })` where supported.
    - Hooks into the existing **Flash** toggle:
      - Turning it **on** starts camera and scan loop.
      - Turning it **off** stops the loop and camera tracks.
    - Hidden `<video>` element is used as a `CanvasImageSource` for `detect(...)`.
    - Debounces identical values for 1s to avoid spamming `processScan` on a steady QR.
    - If BarcodeDetector or camera is unavailable, shows a **non-blocking warning** and falls back to manual input.

## Current Behavior

- Scanner events list:
  - Shows events assigned to the current scanner.
  - Each row has an Actions menu with **Download data** and **Upload data** (upload is not yet implemented).

- Downloading scanner data:
  - Populates Dexie with:
    - Event metadata + `sessionConfig`.
    - Allowed student list (name, LRN, grade, section, `qrHash`).
  - Caches are per-event and per-device.

- Scanner detail page:
  - If resources not downloaded:
    - Shows a friendly "Scanner resources missing" message with guidance.
  - If resources are present:
    - Header shows real event name and venue.
    - Bottom card shows last scan and live stats.
    - Scanning can happen via:
      - **Camera** (BarcodeDetector-based), or
      - **Manual QR input** (for dev/testing).
    - All scans are inserted into `scanQueue` and reflected in stats.

## TODO

- **Time-based session logic (smart scanning)**
  - Implement a pure helper that, given `event.sessionConfig` + current time, selects the active session and classifies scans as:
    - Too early / event not started.
    - Within open window → PRESENT.
    - After `lateAfter` and before `closes` → LATE.
    - After `closes` → event closed (DENIED).
  - Use this inside `processScan` to set `ScanStatus` to `PRESENT` vs `LATE` vs `DENIED` instead of always `PRESENT`.

- **Audience validation**
  - During scan, validate that the student belongs to the event audience (`target_audience`).
  - If not allowed for that event, return a DENIED status with a clear message (e.g. wrong level/section).

- **Sync-up pipeline**
  - Add an API endpoint to accept bulk `scanQueue` payloads and write to `attendance_logs`.
  - Implement a "Submit scans" action on `[eventId]` that:
    - Sends pending scans.
    - Marks them as `syncStatus = "synced"` on success.
    - Handles retries and conflict cases.

- **Resilience & UX polish**
  - Handle camera permission denials gracefully (explicit messaging, soft fallback to manual mode).
  - Add visual feedback while camera is starting/stopping.
  - Consider a visible indicator when data is cached locally for an event (e.g. a small "Offline ready" badge on the scanner events list).

- **Security & privacy**
  - Reconfirm that QR payloads expose only `qr_hash` (no PII).
  - Ensure downloaded Dexie data is scoped to the logged-in scanner and only to events they are assigned to.

- **Testing & monitoring**
  - Add basic logging around scanner resource downloads and scanQueue sync operations.
  - Plan smoke tests on target devices (Android phones, low-end hardware, spotty networks).
