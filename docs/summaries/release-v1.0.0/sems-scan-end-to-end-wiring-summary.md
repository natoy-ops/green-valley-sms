# SEMS Scanner Flow – /sems/scan End-to-End Wiring Summary

## Overview

This summary captures the work done to wire the **SEMS scanner experience** end-to-end, focusing on:

- Listing events where the logged-in user is configured as a **scanner**.
- Providing a dedicated **scanner-facing UI** at `/sems/scan` and a scanning window at `/sems/scan/[eventId]`.
- Implementing a backend API pipeline that respects existing SEMS architecture (repository → service → API route) and Supabase schema.

The work is currently at **Level A**:

- `/sems/scan` is wired to real backend data via a new API.
- `/sems/scan/[eventId]` still uses mock student scan data, but the path is ready to be connected to attendance logging.

## Backend Changes

### 1. EventRepository (SEMS Infrastructure Layer)

File: `src/modules/sems/infrastructure/event.repository.ts`

Key responsibilities remain:

- CRUD for `events`.
- Facility checks and venue availability queries.
- Attendance counts using `event_sessions` and `attendance_logs`.

#### 1.1 Existing methods (unchanged but relevant)

- `findAll(options)`
  - Lists events with joined `facilities` data.
  - Supports pagination (`page`, `pageSize`) and filters (`facilityId`, `searchTerm`).
  - Returns `{ events: EventWithFacilityRow[], total }`.
- `countEventAttendees(eventId)`
  - Uses `event_sessions` → `attendance_logs` to count unique student scans.

#### 1.2 New method: `findAllForScanner`

- Signature:
  - `async findAllForScanner(scannerId: string, options?: { page?: number; pageSize?: number; facilityId?: string; searchTerm?: string; }): Promise<{ events: EventWithFacilityRow[]; total: number }>`
- Behavior:
  - Same `SELECT` shape as `findAll`, including facility join.
  - Applies a JSONB filter on `events.scanner_assignments`:
    - Uses Supabase `.contains` to ensure `scanner_assignments.scannerIds` contains the supplied `scannerId`.
  - Applies the same optional filters (`facilityId`, `searchTerm`).
  - Orders by `start_date` descending and paginates via `range`.
  - Maps raw rows into `EventWithFacilityRow` and returns with total count.

This method is the core data source for the scanner events API.

### 2. EventService (SEMS Application Layer)

File: `src/modules/sems/application/event.service.ts`

#### 2.1 New method: `listScannerEvents`

- Signature:
  - `async listScannerEvents(scannerId: string, options?: ListEventsOptions): Promise<EventListResponseDto>`
- Responsibilities:
  - Delegates to `EventRepository.findAllForScanner(scannerId, options)`.
  - Reuses the same transformation logic as `listEvents` to produce **UI-ready** DTOs:
    - Computes `timeRange` from `session_config` per event (`computeTimeRange`).
    - Computes `audienceSummary` from `target_audience` (`computeAudienceSummary`).
    - Computes `scannerSummary` from `scanner_assignments.scannerIds`.
    - Computes `expectedAttendees` using audience rules + student counts.
    - Uses `countEventAttendees(event.id)` for actual attendees.
    - Derives `status` (`live`, `scheduled`, `completed`) via `computeEventStatus`.
  - Returns `EventListResponseDto`:

    ```ts
    interface EventListResponseDto {
      events: EventListItemDto[];
      pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }
    ```

Result: the scanner-specific list has the same shape as the admin events list, but filtered by scanner assignments.

### 3. New API Route: `/api/sems/events/scanner`

File: `src/app/api/sems/events/scanner/route.ts`

#### 3.1 Authentication

- Reuses the existing Supabase admin client pattern:
  - Extracts token from `Authorization` header (`Bearer ...`) or `auth-token` cookie.
  - Calls `supabase.auth.getUser(token)`.
  - Returns `401 UNAUTHENTICATED` or `401 INVALID_TOKEN` via `formatError` if invalid.

#### 3.2 Query parameters

- `page` – default `1`.
- `pageSize` – default `50`, max `100`.
- `facilityId` – optional, filters by venue.
- `search` – optional, used to filter by event title (and conceptually venue via service logic).

#### 3.3 Implementation

- Constructs `EventRepository` with the admin Supabase client.
- Constructs `EventService` with that repository.
- Calls `eventService.listScannerEvents(userId, { page, pageSize, facilityId, searchTerm })`.
- Returns standardized JSON:

  ```json
  {
    "success": true,
    "data": {
      "events": [ ... ],
      "pagination": { ... }
    },
    "meta": { "timestamp": "..." }
  }
  ```

- On error, logs and returns:

  ```json
  {
    "success": false,
    "error": {
      "code": "SCANNER_EVENT_LIST_FAILED",
      "message": "Unable to load scanner events.",
      "details": "..." // error message
    },
    "meta": { "timestamp": "..." }
  }
  ```

## Frontend Changes – `/sems/scan` UI

File: `src/app/(dashboard)/sems/scan/page.tsx`

### 1. State and hooks

- Converted from static `MOCK_SCANNER_EVENTS` to dynamic state:

  ```ts
  const [events, setEvents] = useState<ScannerEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  ```

- `ScannerEventItem` now mirrors `EventListItemDto` plus UI fields:

  ```ts
  interface ScannerEventItem {
    id: string;
    title: string;
    date: string;        // Today / Tomorrow / formatted date
    timeRange: string;   // e.g. "07:00 - 08:00 AM"
    venue: string;       // facility or "TBA"
    role: string;        // currently "Scanner"
    status: "live" | "upcoming" | "completed";
    expectedAttendees: number;
    checkedIn: number;
    startDate: string;   // raw YYYY-MM-DD for stats
  }
  ```

### 2. Fetching scanner events

- `loadEvents` (wrapped in `useCallback`) performs the fetch:

  - Builds query string from `appliedSearch`, `page=1`, `pageSize=50`.
  - Calls `fetch('/api/sems/events/scanner?...')`.
  - Parses JSON safely; on non-200, uses `error.message` from the API if present.
  - Maps API `events` into `ScannerEventItem`:

    - `title` → `title`.
    - `timeRange` → `timeRange`.
    - `venue ?? "TBA"`.
    - `actualAttendees` → `checkedIn`.
    - `expectedAttendees` → `expectedAttendees`.
    - `status` (`live/scheduled/completed`) → `live/upcoming/completed` for UI.
    - `startDate` → used to compute `date` label via `formatDateLabel`.

- `useEffect` fires `loadEvents()` on initial mount and whenever `appliedSearch` changes.

### 3. Search behavior

- The search input is controlled:

  ```tsx
  <Input
    type="search"
    placeholder="Search events by title or venue..."
    value={searchInput}
    onChange={(event) => setSearchInput(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === "Enter") {
        setAppliedSearch(searchInput);
      }
    }}
  />
  ```

- Hitting **Enter** applies the search term and triggers a reload.

### 4. Stats cards

- Stats are now computed from live data via `useMemo`:

  ```ts
  const stats = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

    let live = 0;
    let upcoming = 0;
    let completed = 0;
    let today = 0;
    let totalCheckIns = 0;

    for (const event of events) {
      totalCheckIns += event.checkedIn;
      if (event.startDate === todayIso) today += 1;
      if (event.status === "live") live += 1;
      else if (event.status === "completed") completed += 1;
      else upcoming += 1;
    }

    return { total: events.length, live, upcoming, completed, today, totalCheckIns };
  }, [events]);
  ```

- The four top cards show:
  - **Today’s scanner events** → `stats.today`.
  - **Live check-ins** → `stats.totalCheckIns`.
  - **Upcoming assignments** → `stats.upcoming`.
  - **Total scanner events** → `stats.total`.

### 5. Table states and UX

- The table body now handles multiple states:

  - **Loading:**

    ```tsx
    {loading && (
      <TableRow>
        <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-500">
          Loading scanner events...
        </TableCell>
      </TableRow>
    )}
    ```

  - **Error:**

    ```tsx
    {!loading && error && (
      <TableRow>
        <TableCell colSpan={5} className="py-6 text-center text-sm text-red-600">
          <div className="flex flex-col items-center gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadEvents()}>
              Retry
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )}
    ```

  - **Empty:**

    ```tsx
    {!loading && !error && events.length === 0 && (
      <TableRow>
        <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-500">
          No scanner events found yet.
        </TableCell>
      </TableRow>
    )}
    ```

  - **Success:** rows mapped from `events` preserving the original UI styling and click behavior:

    - Clicking a row still navigates to `/sems/scan/[eventId]`.
    - Role badge currently shows a generic `"Scanner"` label; future work can plug in specific role per event if modeled.

## Current Status and Next Steps

### Status

- `/sems/scan` now:
  - Authenticates via existing cookie/session flow.
  - Calls `/api/sems/events/scanner` to get **scanner-specific** events.
  - Shows live counts and statuses using real event and attendance data.
  - Handles loading, error, and empty states gracefully.

### Next Steps (Potential Level B)

1. **Wire `/sems/scan/[eventId]` to real event data**
   - Call `GET /api/sems/events/[id]` to display full event details.
   - Optionally surface summary stats (actual vs expected attendees) in the scanning screen.

2. **Implement scan logging endpoint(s)**
   - Decode QR (using `students.qr_hash`).
   - Resolve current `event_session` based on `session_type`, `start_time`, `late_threshold_time`, and `end_time`.
   - Insert into `attendance_logs` with computed `status` (`present` / `late`).
   - Handle duplicate scans via the unique constraint `(event_session_id, student_id)` and return meaningful error states (`already_scanned`, `not_allowed`, etc.).

3. **Connect scanning UI to logging API**
   - Replace mock student card on `/sems/scan/[eventId]` with real scan results.
   - Show appropriate visual states (success, late, duplicate, denied) based on API response.

This summary should serve as the reference for how the SEMS scanner events pipeline is structured and how `/sems/scan` is now integrated end-to-end with the backend.
