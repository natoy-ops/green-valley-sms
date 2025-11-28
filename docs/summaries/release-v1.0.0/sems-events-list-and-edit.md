# SEMS – Events List & Edit Conversation Summary

## 1. Feature Overview

- **Goal**
  - Implement an end-to-end "List of Events" box for the SEMS module, with real data from Supabase, and add edit support so staff can correct/update events after creation.
- **Key capabilities**
  - Create events with:
    - Title, date range, optional venue (facility), audience configuration, and per-day session configuration.
  - List events with:
    - Event name, date, time range, venue, audience summary, expected vs. actual attendees, and computed status (`live | scheduled | completed`).
  - Edit events:
    - Clicking an event row opens the same dialog in **Edit** mode with the form pre-populated.
    - Changes are persisted via a dedicated update flow.

## 2. Domain & Types

- **New / updated types** (in `src/modules/sems/domain/types.ts`):
  - `EventStatus` – union type: `"live" | "scheduled" | "completed"`.
  - `EventListItemDto` – DTO for list rows:
    - `id`, `title`, `timeRange`, `venue`, `audienceSummary`, `actualAttendees`, `expectedAttendees`, `status`, `startDate`, `endDate`.
  - `EventListResponseDto` – list + pagination metadata.
  - `CreateEventDto` – create payload (already used by the Create Event flow).
  - `UpdateEventDto` – new DTO for partial updates:
    - `id` (required), plus optional `title`, `description`, `startDate`, `endDate`, `facilityId`, `audienceConfig`, `sessionConfig`.

## 3. Repository Layer (Supabase)

- **File**: `src/modules/sems/infrastructure/event.repository.ts`
- **Key additions**
  - `findAll(...)` – list events with:
    - Pagination and optional filters (`facilityId`, `searchTerm`).
    - Join to `facilities` to expose venue name/location.
  - `countActiveStudents()` – number of active students (for `ALL_STUDENTS` audience rule).
  - `countStudentsByLevels(levelIds)` – count by grade/year levels.
  - `countStudentsBySections(sectionIds)` – count by sections.
  - `getLevelNames(levelIds)` – level names for audience summary.
  - `countEventAttendees(eventId)` – distinct students from `attendance_logs` via `event_sessions`.
  - `update(dto: UpdateEventDto, updatedBy: string)` – **new** partial update method:
    - Builds an `updatePayload` only from defined fields.
    - Sets `updated_by` and `updated_at`.
    - Returns the updated `EventRow`.

## 4. Service Layer (Business Logic)

- **File**: `src/modules/sems/application/event.service.ts`
- **Existing create flow**
  - `createEvent(dto: CreateEventDto, createdBy: string)`:
    - Validates input (`validateCreateEvent`).
    - Ensures `facilityId` exists if provided.
    - Inserts into `events` and then fetches with `findByIdWithFacility` for a full `EventDto`.

- **New list logic**
  - `listEvents(options: ListEventsOptions): Promise<EventListResponseDto>`:
    - Calls repository `findAll` and counting helpers.
    - Computes `timeRange` from `session_config` (e.g. `08:00 AM - 01:00 PM`).
    - Computes `audienceSummary` from `target_audience` (rules for all students, levels, sections, students, with includes/excludes).
    - Computes `expectedAttendees` based on audience rules.
    - Computes `status` (`live | scheduled | completed`) using today’s date, session open/close times, and event start/end dates.

- **New update logic**
  - `updateEvent(dto: UpdateEventDto, updatedBy: string): Promise<EventDto>`:
    - Ensures the event exists via `findById`.
    - Validates update payload via `validateUpdateEvent`:
      - `id` required and must be UUID.
      - `title` optional but non-empty if provided.
      - `startDate` / `endDate` (if provided) must be valid `YYYY-MM-DD` and maintain a valid range.
      - Optional `facilityId` validated as UUID or null.
      - Optional `audienceConfig` and `sessionConfig` validated using existing helpers.
    - If `facilityId` is present, checks existence via `facilityExists`.
    - Calls `eventRepository.update(validatedDto, updatedBy)`.
    - Returns hydrated `EventDto` from `findByIdWithFacility`.

## 5. API Routes

### 5.1 Collection Route – `/api/sems/events`

- **File**: `src/app/api/sems/events/route.ts`
- **Common helpers**
  - `formatSuccess`, `formatError` – standardized JSON responses.
  - `getAccessTokenFromRequest` – reads `Authorization: Bearer` or `auth-token` cookie.
  - `authenticateRequest` (updated):
    - Uses `getAdminSupabaseClient().auth.getUser(token)`.
    - **No longer upserts into `profiles`** (removed to avoid RLS errors on `profiles`).
    - Returns `{ userId }` or an error `NextResponse`.

- **POST /api/sems/events** – create event
  - Parses body with `parseRequestBody` (including `audienceConfigJson` and `sessionConfigJson`).
  - Authenticates via `authenticateRequest`.
  - Instantiates `EventRepository` + `EventService`.
  - Calls `eventService.createEvent(dto, userId)`.
  - Handles `ValidationError` (400) and `NotFoundError` (404), plus generic 500.

- **GET /api/sems/events** – list events
  - Auth via `authenticateRequest`.
  - Supports query params:
    - `page`, `pageSize`.
    - `facilityId`.
    - `search` (by title, etc.).
  - Calls `eventService.listEvents({ page, pageSize, facilityId, searchTerm })`.
  - Returns `EventListResponseDto`.

- **PUT /api/sems/events** – update event
  - Auth via `authenticateRequest`.
  - Parses body into an update DTO:
    - `id`, `title`, `description`, `startDate`, `endDate`, `facilityId`, `audienceConfigJson`, `sessionConfigJson`.
  - Instantiates `EventRepository` + `EventService`.
  - Calls `eventService.updateEvent(dto, userId)`.
  - Handles `ValidationError` (400), `NotFoundError` (404), and generic 500 with `EVENT_UPDATE_FAILED`.

### 5.2 Single-Event Route – `/api/sems/events/[id]`

- **File**: `src/app/api/sems/events/[id]/route.ts`
- **GET /api/sems/events/[id]`** – fetch details for editing
  - Auth via direct `getAccessTokenFromRequest` + `supabase.auth.getUser`.
  - Validates `id` as a UUID.
  - Uses `EventRepository.findByIdWithFacility(id)`.
  - Returns `{ event: EventDto }` or 404 if not found.

## 6. Frontend – SEMS Page (`/sems`)

- **File**: `src/app/(dashboard)/sems/page.tsx`

### 6.1 Types & State

- **Types**
  - `EventListItem` – mirrors `EventListItemDto` for the list.
  - `EventEditData` – shape of full event data needed for editing (includes `audienceConfig` and session config `version: 2` dates/sessions).

- **State additions**
  - Events list:
    - `eventsList: EventListItem[]`.
    - `isLoadingEvents: boolean`, `eventsError: string | null`.
  - Edit flow:
    - `editingEventId: string | null` – `null` when creating, set to event ID when editing.
    - `isLoadingEditEvent: boolean` – to show loading state inside the dialog.
    - `isEditMode = editingEventId !== null`.
  - Reused create-event form state for both create & edit flows.

### 6.2 Loading Events

- **`loadEvents` hook**
  - Builds query params from:
    - `venueFilter` → maps selected facility name to `facilityId` via the `facilities` array.
    - `searchTerm`.
  - Calls `GET /api/sems/events`.
  - Expects shape:

    ```ts
    {
      success: boolean;
      data?: { events: EventListItem[]; pagination: { total: number } };
    }
    ```

  - Updates `eventsList`, `isLoadingEvents`, `eventsError` accordingly.
  - Runs on initial load and whenever facilities are ready and filters change.

- **Venue filter dropdown**
  - Uses real facilities from `GET /api/facilities`.
  - Options: `All venues` + each facility name.

### 6.3 Events Table UI

- Columns: **Event Name**, **Date**, **Time**, **Venue**, **Audience**, **Attendees**, **Status**.
- Date formatting:
  - Single day: `MMM d` (e.g. `Nov 27`).
  - Multi-day, same month: `Nov 27 - 28`.
  - Multi-month range: `Nov 27 - Dec 2`.
- Attendees: `actualAttendees / expectedAttendees`.
- Status badge:
  - `live` → green pill + subtle pulse.
  - `completed` → gray pill.
  - `scheduled` → amber pill.
- **Venue display rule**
  - If no venue is set, the cell is rendered as an empty string (no placeholder).

### 6.4 Create & Edit Dialog

- Shared dialog for create & edit:
  - Title text:
    - Create mode: **"Create Event"**.
    - Edit mode: **"Edit Event"**.
  - Subtitle adjusted accordingly.
  - Close/Cancel buttons call `resetForm()` to clear state.
- **Opening the dialog**
  - Create:

    ```tsx
    onClick={() => {
      resetForm();
      setIsCreateDialogOpen(true);
    }}
    ```

  - Edit:
    - `onClick` on a table row calls `openEditDialog(event.id)`.

- **`openEditDialog(eventId)` flow**
  - Sets `editingEventId`, `isCreateDialogOpen`, `isLoadingEditEvent`.
  - Calls `GET /api/sems/events/[id]`.
  - On success, populates:
    - Title.
    - Date range from `startDate` / `endDate`.
    - Selected facility from `event.facility.id`.
    - Audience state from `audienceConfig.rules` (modes: `all`, `level_section`, `students`, `mixed`; includes and excludes).
    - Session state from `sessionConfig.dates` into `dateSessionConfigs` + `enabledPeriods`.
  - Shows a small spinner while loading.

- **Form submit handler**
  - `handleEventFormSubmit`:
    - Serializes hidden `startDate`, `endDate`, `audienceConfigJson`, `sessionConfigJson`.
    - If `editingEventId` is set → `PUT /api/sems/events` with `{ id, ... }`.
    - Else → `POST /api/sems/events`.
    - Handles validation errors and displays first field-level error when present.
    - On success: closes dialog, calls `resetForm()`, and refreshes the events list.
    - Button text reflects mode: `Save Event` / `Update Event`, `Creating...` / `Updating...`.

## 7. RLS / Error Handling Notes

- **Issue encountered**
  - `GET /api/sems/events` originally failed with:

    > `new row violates row-level security policy for table "profiles"`

  - Cause: `authenticateRequest` tried to `upsert` into `profiles` on every SEMS events request using the admin client, which hit RLS.

- **Resolution**
  - Removed the `profiles` upsert from SEMS events `authenticateRequest`.
  - Now SEMS routes only validate the auth token and return `userId`, avoiding RLS on `profiles` entirely.

## 8. Current State & Next Steps

- **Current state**
  - SEMS has a complete slice for **Create → List → Edit** events.
  - Backend logic is layered (domain → repository → service → API) and returns UI-ready DTOs.
  - Frontend `/sems` page uses real data, with filters, status computation, and an edit-in-place flow.
  - RLS issues related to `profiles` have been removed from this feature path.

- **Suggested next steps**
  - Add automated tests for:
    - `listEvents` (status computation, audience summary, attendee counts).
    - `updateEvent` validation and partial update behavior.
  - Add pagination UI to the events table (using `pagination.total` from the API).
  - Consider a dedicated profile-sync flow that respects RLS, rather than doing it inside feature routes.
  - Extend events listing with additional filters (e.g. by date range, status, or audience type) once needed.
