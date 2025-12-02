# Bulk Import UX & Student Events – Chat Summary

## Main Point

Improve the student-facing experience around two flows:

- Bulk student import in SIS (UX clarity, reliability, and persistence of results)
- Student view of SEMS events, with a dedicated `/sems/student-events` page and proper role-based routing after login.

## Key Changes

### 1. Bulk Import Students UX (SIS)

- Replaced transient Sonner toasts with **persistent shadcn `Alert`** components inside the bulk import dialog.
- Introduced `bulkImportStatus` ("idle" | "loading" | "success" | "error") to drive alert content and state.
- Added a **loading indicator** during import:
  - `Loader2` spinner icon in a loading Alert: "Importing students… Please wait. Do not close this dialog until the import completes."
  - Spinner also shown in the submit button while `isImportingStudents` is true.
- Updated dialog controls to be **safe during in-progress imports**:
  - Backdrop click, X button, and Cancel button all **block closing** while `isImportingStudents` is true.
  - X and Cancel are visually disabled when an import is running.
- Implemented **result persistence and credential downloads**:
  - `resetBulkImportState(preserveCredentials = false)` now accepts a flag to keep `studentCredentialsForDownload` and `guardianCredentialsForDownload` when closing.
  - When import succeeds, credentials are stored in state and a **persistent banner** is shown on the main SIS page (outside the dialog) after closing.
  - Banner shows counts (student/parent accounts created) and provides explicit CSV download buttons for both students and guardians.
  - Banner can be dismissed, which clears credential state.

### 2. Student Events Page – `/sems/student-events`

- Added a new **student-only page** at `src/app/(dashboard)/sems/student-events/page.tsx`.
- Data source:
  - Uses existing `GET /api/sems/events/student`, backed by `EventService.listStudentEvents`.
  - Service already restricts to `lifecycleStatuses: ["published"]` and visibilities `["student", "public"]`.
  - On the client, we further keep only events with `lifecycleStatus` in `["published", "completed"]` so students see published events and their history.
- Page behavior:
  - Uses `useAuth` to ensure the current user has the `STUDENT` role.
  - If user is not a student, shows a **destructive Alert** explaining this page is for student accounts.
  - Falls back to the global 401/login flow if the API returns 401.

### 3. Student Events UI/UX (Social-Style Feed)

- Overall layout:
  - Full-width **gradient hero section** with title ("Your school events, in one place."), subtitle, and quick stats chips.
  - Social-media-style **feed of event cards**, in a responsive grid (2 columns on medium screens).
- Hero stats:
  - Counts of **upcoming**, **live**, and **total** events computed from the loaded list.
  - Displayed as small, rounded chips for a modern, app-like feel.
- Filters and search:
  - Text search across `title`, `venue`, and `audienceSummary`.
  - Filter tabs: **All**, **Upcoming**, **Live now**, **Past** implemented via pill-style buttons.
  - Filtering is purely client-side on the loaded events.
- Event cards:
  - Top gradient accent bar color-coded by `status` ("live", "scheduled", "completed").
  - Badges:
    - Status badge with labels: "Live now", "Upcoming", or "Completed".
    - Optional "Public" badge when `visibility === "public"`.
  - Primary details:
    - Title (two-line clamp).
    - Date range (start/end) and `timeRange` with icons.
    - Venue (with fallback "Venue to be announced").
    - Audience summary row (who the event is for).
  - Attendance visualization:
    - `actualAttendees / expectedAttendees` and a small progress bar (emerald → sky gradient).
- States:
  - **Loading**: centered spinner + text "Loading your events…".
  - **Error**: destructive Alert with message from API.
  - **Empty**: dashed card with icon and message explaining that events will appear when the school publishes ones that include the student.

### 4. Role-Based Routing and Post-Login Redirect

- Central routing logic is in `src/core/auth/routeAccess.ts`, used by both middleware and `AuthContext`.
- Adjusted **route access rules**:
  - Added a dedicated rule for `/sems/student-events`:
    - `allowedRoles: ["STUDENT"]` so students can access this path.
  - Kept `/sems` main management route restricted to admins.
- Updated **default route mapping** in `getDefaultRouteForRoles`:
  - `SUPER_ADMIN` / `ADMIN` → `/dashboard`.
  - `TEACHER` → `/dashboard/teacher`.
  - `SCANNER` → `/sems/scan`.
  - **New**: `STUDENT` → `/sems/student-events`.
  - Fallback → `/no-access`.
- Post-login redirect path is chosen in `AuthContext.handleLogin`:
  - After `authLogin`, it calls `getDefaultRouteForRoles(loggedInUser.roles)` and sets `window.location.href` to the returned route.
  - With the new mapping, students now land on `/sems/student-events` immediately after login.
- Middleware (`middleware.ts`) also uses `getDefaultRouteForRoles` when a user doesnt have access to a route, ensuring consistent fallback behavior across direct navigation and login.

## Impact

- **Bulk student import** is now safer, clearer, and more professional:
  - Students and guardians credentials can no longer be "lost" if the dialog is closed; a page-level banner persists results and downloads.
  - Admins see obvious loading state and cannot accidentally close the dialog mid-import.
- **Student events experience** now has a **dedicated, modern page** tailored to students:
  - Feels like a social feed, with clear status, time, venue, and attendance.
  - Only shows events that are actually published and relevant to that student.
- **Login UX for students** is streamlined:
  - Student users are redirected directly to the new `/sems/student-events` hub after login, matching their primary use case.
