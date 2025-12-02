# SEMS – Role-Based Event Workflow (Phase 1)

This document defines the **event lifecycle, approval workflow, roles, and permissions** for the Student Event Management System (SEMS), aligned with the existing auth model and SEMS API endpoints.

It is focused on **Phase 1**: getting a professional, end‑to‑end workflow for events that is enforceable at the **database, API, and UI** layers.

---

## 1. Goals & Scope

- **Standardize event lifecycle** from creation to completion/cancellation.
- **Enforce approvals**: organizers cannot self‑publish; admins/approvers must explicitly approve.
- **Clarify roles & permissions** for Admin, Organizer, Student, Guest/Parent.
- **Integrate with existing architecture**:
  - Next.js App Router + Supabase.
  - Roles from `app_users` (`SUPER_ADMIN`, `ADMIN`, `TEACHER`, `STAFF`, `PARENT`, `SCANNER`, etc.).
  - SEMS APIs under `/api/sems/events*`.
- Keep the design **simple but extensible** for future modules (e.g. full student portal).

---

## 2. Event Lifecycle & Status Model

### 2.1 Status Enum

Add/standardize a **lifecycle status** enum, persisted in `events.lifecycle_status` (backed by Postgres enum or constrained text):

- `draft`
- `pending_approval`
- `approved`
- `published`
- `completed`
- `cancelled`

**Default:** `draft` on creation.

For the UI, keep using the existing computed `EventStatus` (`"live" | "scheduled" | "completed"`) derived from dates and session configuration. This is separate from the persisted approval lifecycle stored in `lifecycle_status`.

### 2.2 Allowed Transitions

Enforce the following state machine at the API layer (and reflected in the UI):

- **DRAFT → PENDING_APPROVAL**
  - Action: "Submit for approval".
  - Who: Organizer (creator/owner) or Admin.

- **PENDING_APPROVAL → APPROVED**
  - Action: "Approve".
  - Who: Admin (and future Department Head).

- **PENDING_APPROVAL → DRAFT**
  - Action: "Request changes" / "Reject".
  - Who: Admin.
  - Stores rejection comment.

- **APPROVED → PUBLISHED**
  - Action: "Publish".
  - Who: Admin.

- **APPROVED → PENDING_APPROVAL** (optional, for edits)
  - Triggered when critical details are changed (date, time, audience, capacity, venue).
  - Who: Organizer or Admin.

- **PUBLISHED → COMPLETED**
  - Action: "Mark as completed" (usually after event ends and scans are synced).
  - Who: Admin.

- **DRAFT | PENDING_APPROVAL | APPROVED | PUBLISHED → CANCELLED**
  - Action: "Cancel event".
  - Who: Admin.
  - Optionally, Organizer may request cancellation which must be confirmed by Admin.

- **COMPLETED & CANCELLED**
  - **Terminal states**: no further status transitions allowed.
  - Only metadata (notes, report exports) may be updated.

**Forbidden transitions** (must be blocked in the API):

- `DRAFT` → `APPROVED | PUBLISHED | COMPLETED | CANCELLED` (except via the allowed paths above).
- `PENDING_APPROVAL` → `PUBLISHED | COMPLETED` directly.
- `APPROVED` → `COMPLETED` directly (must be `PUBLISHED` first).
- Any status → `DRAFT` except the explicit `PENDING_APPROVAL → DRAFT` rejection flow.

### 2.3 Status-Dependent Behavior

- Only events with **`lifecycle_status = 'published'`** can:
  - Be visible in **student/parent and public listings** (subject to visibility rules).
  - Expose scanner resources (`/api/sems/events/[id]/scanner-resources`).
- **COMPLETED** events:
  - Scanning must be disabled.
  - Analytics/reporting endpoints continue to work.
- **CANCELLED** events:
  - Must not be returned in student/parent or public lists.
  - Scanner resources must be disabled.

---

## 3. Domain & Data Model Additions

Assuming a core `events` table already exists, extend it with fields to support workflow and visibility.

### 3.1 Event Ownership & Audit Fields

- `created_by` (existing FK → `app_users.id`)
- `owner_user_id` (FK → `app_users.id`, typically the Organizer)
- `lifecycle_status` (enum/text as above)
- `submitted_for_approval_at` (timestamp, nullable)
- `approved_by` (FK → `app_users.id`, nullable)
- `approved_at` (timestamp, nullable)
- `approval_comment` (text, nullable)
- `rejected_by` (FK → `app_users.id`, nullable)
- `rejected_at` (timestamp, nullable)
- `rejection_comment` (text, nullable)
- `published_at` (timestamp, nullable)
- `completed_at` (timestamp, nullable)
- `cancelled_by` (FK → `app_users.id`, nullable)
- `cancelled_at` (timestamp, nullable)
- `cancellation_reason` (text, nullable)

Optional for later (Phase 1.5+):

- `event_status_history` table to track all status changes with `changed_by`, `from_status`, `to_status`, `changed_at`, `comment`.

### 3.2 Visibility & Audience

To control which users see which events:

- `visibility` enum column on `events`:
  - `internal` – visible only to staff (Admin, Organizer, Scanner).
  - `student` – visible to logged-in students and parents of eligible students.
  - `public` – visible to anyone (including unauthenticated guests/parents accessing a public page).

- Audience is already modeled via `target_audience` JSONB with rules (`ALL_STUDENTS`, `LEVEL`, `SECTION`, `STUDENT`) and will continue to be the single source of truth for:
  - Which students are eligible for the event.
  - Which students appear in scanner resources and any future registration views.

This same `target_audience` configuration must drive **who can view/register** for an event in student/parent-facing endpoints.

### 3.3 Registration (Design Outline)

For events that require sign-up:

- `registration_required` (boolean)
- `registration_opens_at` / `registration_closes_at` (timestamps)
- `capacity_limit` (integer, nullable for unlimited)
- `event_registrations` table:
  - `id`
  - `event_id` (FK)
  - `student_id` (FK to `students` table)
  - `registered_by_user_id` (FK to `app_users`, supports parent registering on behalf of child)
  - `registered_at`

Phase 1 can **prepare the schema** even if student-facing UI is minimal.

---

## 4. Roles & Conceptual Mapping

We align requested roles with existing `app_users.roles` values.

- **Admin**
  - System: `SUPER_ADMIN`, `ADMIN`.
  - Capabilities: full SEMS control, configuration, approvals, reporting.

- **Organizer (Teacher/Staff/Club Advisor)**
  - System: `TEACHER`, `STAFF` (and optionally `ADMIN` acting as an organizer).
  - Capabilities: create/manage own events, submit for approval, view their events and stats.

- **Student**
  - System: future `STUDENT` role or derived from SIS student records.
  - Capabilities (design for Phase 1, even if UI is basic): view and register for allowed events.

- **Guest/Parent**
  - System: `PARENT` (authenticated) and unauthenticated visitors.
  - Capabilities: view **public** events only; parents can optionally register their children.

- **Scanner**
  - System: `SCANNER`.
  - Capabilities: access scanner resources for **published** events only; no create/approve rights.

---

## 5. Permissions Matrix (Core Questions)

### 5.1 Who can create events?

- **Allowed roles**:
  - **Current implementation:** `ADMIN`, `SUPER_ADMIN` – can create events for any audience, any department (see `ADMIN_ROLES` and `SUPPORTED_APP_ROLES`).
  - **Planned extension:** `TEACHER`, `STAFF` – will be able to create events where they are `owner_user_id` once organizer UI and app-role support are enabled.

- **Behavior on creation**:
  - Default lifecycle: `draft`.
  - `created_by` (existing column) and `owner_user_id` set to the current user.
  - Admins may optionally create directly as `APPROVED` → `PUBLISHED` for low‑risk events (config flag), but Phase 1 default is still `DRAFT` → approval.

### 5.2 Who can submit/approve events?

- **Submit for approval (DRAFT → PENDING_APPROVAL)**
  - Organizer (event owner) or Admin.
  - Sets `submitted_for_approval_at`.

- **Approve (PENDING_APPROVAL → APPROVED)**
  - `ADMIN`, `SUPER_ADMIN`.
  - Future: extend to department heads (`TEACHER` with `is_department_head` flag).
  - Sets `approved_by_user_id`, `approved_at`, `approval_comment` (optional).

- **Reject / Request changes (PENDING_APPROVAL → DRAFT)**
  - `ADMIN`, `SUPER_ADMIN`.
  - Sets `rejected_by_user_id`, `rejected_at`, `rejection_comment` (required).

- **Publish (APPROVED → PUBLISHED)**
  - `ADMIN`, `SUPER_ADMIN`.
  - Sets `published_at`.

### 5.3 Who can edit after approval?

Define edit rules per status:

- **DRAFT**
  - Editable fields: all.
  - Who: Organizer (owner) + Admin.

- **PENDING_APPROVAL**
  - Organizer can **cancel submission** (back to `DRAFT`) but cannot change core fields without reverting to `DRAFT`.
  - Admin can edit core fields (date, time, audience, capacity) and keep in `PENDING_APPROVAL` or revert to `DRAFT`.

- **APPROVED (not yet published)**
  - Organizer and Admin can edit **non-critical** fields (description, notes, attachments) without status change.
  - Editing critical fields (date, time, venue, audience) automatically moves status back to `PENDING_APPROVAL` and clears `approved_by` / `approved_at`.

- **PUBLISHED**
  - Admin can:
    - Edit **non-critical** display fields (description, minor text corrections).
    - Schedule and execute `PUBLISHED → COMPLETED`.
    - Cancel the event (`PUBLISHED → CANCELLED`).
  - Organizer may not change core configuration; can only view and add post‑event notes if allowed.

- **COMPLETED / CANCELLED**
  - No structural edits; Admin may add notes/summary fields only.

### 5.4 Who can see which events?

Visibility is the combination of `visibility`, `lifecycle_status`, and audience filters.

- **Admin (`ADMIN`, `SUPER_ADMIN`)**
  - Can see **all** events in all statuses and visibilities.

- **Organizer (`TEACHER`, `STAFF`)**
  - Can see:
    - All events where they are `owner_user_id` or `created_by_user_id` (all statuses).
    - Other internal events (`visibility = INTERNAL`) relevant to their department (optional, configurable).

- **Scanner (`SCANNER`)**
  - In scanner UI and APIs:
    - Can list events that have `lifecycle_status = 'published'` and are not `cancelled`/`completed`.
    - Can load scanner resources only for those events.

- **Student**
  - Can see events where:
    - `lifecycle_status = 'published'`, and
    - `visibility IN ('student', 'public')`, and
    - They are included by the event's `target_audience` rules (e.g. matching LEVEL/SECTION/STUDENT rules).

- **Parent (`PARENT`)**
  - Same as Student, but filtered by their children’s enrollment (levels/sections) according to `target_audience` rules.

- **Guest (unauthenticated)**
  - Can see events where:
    - `lifecycle_status = 'published'`, and
    - `visibility = PUBLIC`.

### 5.5 Who can register for events?

- **Student**
  - Can register for events with:
    - `lifecycle_status = 'published'`.
    - `registration_required = true`.
    - Now < `registration_closes_at`.
    - Capacity not exceeded.

- **Parent (`PARENT`)**
  - Same constraints as student, but chooses which eligible child to register.

- **Admin / Organizer**
  - Can add registrations on behalf of students (e.g., bulk add from a class list).

---

## 6. API-Level Implementation Plan

Leverage existing SEMS endpoints from `docs/backend-api-endpoints.md`.

### 6.1 `/api/sems/events` (GET, POST, PUT, DELETE)

- **GET `/api/sems/events`**
  - Add filters: `lifecycleStatus`, `visibility`, `owner`, `date range` (mapping to `events.lifecycle_status`, `events.visibility`, etc.).
  - Apply role-based scoping:
    - Admin: full list (current implementation).
    - Organizer/Student/Parent/Guest: will use dedicated read-only endpoints such as `/api/sems/events/public` and `/api/sems/events/student` instead of `/api/sems/events` (see 6.3).

- **POST `/api/sems/events`**
  - Roles:
    - **Current:** `ADMIN`, `SUPER_ADMIN` (via `ADMIN_ROLES`).
    - **Planned:** extend to `TEACHER`, `STAFF` when organizer UI is introduced.
  - Force `lifecycle_status = 'draft'` for non-admins.
  - Set `created_by` and `owner_user_id`.

- **PUT `/api/sems/events`**
  - Input includes `id`, updated fields, and optionally an `action` (`SUBMIT_FOR_APPROVAL`, `APPROVE`, `REJECT`, `PUBLISH`, `COMPLETE`, `CANCEL`).
  - Server enforces valid transitions:
    - Check current status.
    - Check caller role + ownership (for organizers).
    - Apply state machine and audit fields.

- **DELETE `/api/sems/events`**
  - Restrict to `ADMIN`, `SUPER_ADMIN`.
  - Only allow delete when `lifecycle_status = 'draft'` and no registrations/scans exist.
  - Otherwise require `lifecycle_status = 'cancelled'` and keep event as historical data.

### 6.2 Scanner & Stats Endpoints

- `/api/sems/events/[id]/scanner-resources`
  - Only allow when `lifecycle_status = 'published'`.
  - Deny for `CANCELLED`/`COMPLETED`.

- `/api/sems/events/[id]/scans`
  - Only accept scans while event is in `lifecycle_status = 'published'` (and within configured time window).

- `/api/sems/events/[id]/stats`
  - Accessible to Admin and Organizer for all non‑deleted events.

### 6.3 Student/Parent/Public Listings (Future routes)

- Add dedicated read-only endpoints (Phase 1 schema ready, UI can follow):
  - `/api/sems/events/public` – Guest + Parent, `lifecycle_status = 'published'`, `visibility = 'public'`.
  - `/api/sems/events/student` – `STUDENT`/`PARENT`, `lifecycle_status = 'published'`, `visibility IN ('student', 'public')`, filtered by audience.

---

## 7. UI & Workflow Implementation Plan

### 7.1 Admin Dashboard

- **Event list page**
  - Columns: Title, Date, Audience, Lifecycle Status, Live Status, Visibility, Owner, Actions.
  - Filters: status, visibility, date range, owner.

- **Approval queue**
  - Dedicated view for `PENDING_APPROVAL` events.
  - Actions per row: Approve, Reject (with comment), View details.

- **Event detail actions**
  - Buttons shown based on status and role:
    - `Submit for approval`, `Approve`, `Reject`, `Publish`, `Mark as completed`, `Cancel`.
  - Each action calls the appropriate `/api/sems/events` `PUT` with `action`.

### 7.2 Organizer (Teacher/Staff) Experience

- **My Events** page
  - Shows events where user is `owner_user_id`.
  - Status badges with clear meaning.
  - Actions:
    - Draft: Edit, Submit for approval, Delete.
    - Pending: View, Cancel submission (back to Draft if allowed).
    - Approved: Edit limited fields; edits that change core details trigger re‑approval.
    - Published: View stats; limited edit if allowed.

- **Event editor**
  - Wizard or single page:
    - Basic details, Date/Time, Audience, Visibility, Registration options.
  - At the end: `Save as draft` or `Submit for approval`.

### 7.3 Student & Parent Experience (Phase 1 Ready)

- **Event catalog page**
  - Lists `PUBLISHED` events filtered by visibility + audience.
  - For logged-in students/parents, show only eligible events.

- **Event detail & registration**
  - Shows basic event info, capacity, registration state.
  - `Register` button (if `registration_required`); calls registration endpoint and writes to `event_registrations`.

### 7.4 Scanner Experience

- Show only **current and upcoming events with `lifecycle_status = 'published'`** in the scanner selection.
- If event transitions to `COMPLETED` or `CANCELLED`, scanner:
  - Stops accepting scans and shows appropriate status message.

---

## 8. Step-by-Step Delivery Plan (Phase 1)

1. **Database migrations**
   - Add status enum and workflow/audit fields to `events`.
   - Add visibility fields and (optionally) registration tables.

2. **API enforcement**
   - Implement state machine logic and role checks in `/api/sems/events`.
   - Restrict scanner/stat endpoints based on `status`.

3. **Admin UI**
   - Event list + filters.
   - Approval queue and actions.
   - Status-aware event detail actions.

4. **Organizer UI**
   - My Events page with status badges.
   - Event editor with draft + submit flows.

5. **Visibility & basic listings**
   - Ensure staff views show INTERNAL + all statuses.
   - Implement basic student/parent/public read-only listing (even if registration UI is minimal at first).

6. **Scanner integration**
   - Update scanner selection to only show PUBLISHED events.
   - Block scans when events are CANCELLED/COMPLETED.

7. **QA & hardening**
   - Test all allowed and forbidden transitions.
   - Verify permissions per role and per endpoint.
   - Add basic audit checks in the database.

This plan, once implemented, will give SEMS a clear, enforceable event workflow tied to roles and permissions, and will complete the core Phase 1 requirements for event management in the broader School Management System.
