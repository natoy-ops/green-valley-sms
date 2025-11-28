# USMS – Conversation Summary (Auth, Structure, Login UI)

## 1. Project & Architecture Decisions

- **Single app, role-based**
  - Use a **single Next.js App Router app** with route groups for different surfaces:
    - `(auth)` for login flows.
    - `(dashboard)` for staff/admin/teacher areas.
    - `(scanner)` for SEMS scanning.
    - `(parent)` for parent portal.
  - Root path `/` currently redirects to `/login`.

- **High-level folder structure**
  - `src/core/` – cross-cutting concerns (config, db, auth, http, errors, logger, offline, types).
  - `src/modules/` – domain modules per project phase:
    - `sis`, `sems`, `academics`, `exams`, `finance`, `hr`, `transport`, `library`, `communication`.
    - Each module structured as `domain/`, `application/`, `infrastructure/`, `ui/`.
  - `src/shared/` – reusable UI and utilities:
    - `components/{ui,layout,data-display,feedback,forms}`, `hooks/`.
  - `src/app/roadmap/page.tsx` – moved the original USMS Modules Roadmap page here.
  - `src/app/page.tsx` – now a simple redirect to `/login`.

## 2. Auth & Login System Design

- **Documentation**
  - Created `docs/AUTH_LOGIN_SYSTEM.md` describing the full auth/login design for the Unified School Management System.

- **Key elements**
  - Supabase Auth for email/password and sessions.
  - Two Supabase clients:
    - Browser client in `core/db/supabase-client.browser.ts`.
    - Admin/server client in `core/db/supabase-client.admin.ts`.
  - Client-side abstractions:
    - `AuthService` for `login`, `logout`, `getCurrentUser`, role helpers.
    - `SessionService` for session lifecycle and activity tracking.
    - `AuthContext` + `useAuth` for React state and role-aware helpers.
  - API routes (to be implemented):
    - `POST /api/auth/login` – validate credentials, set HTTP-only cookies (`auth-token`, `user-id`, `user-roles`, optional `school-id`).
    - `POST /api/auth/logout` – clear cookies.
    - `GET /api/auth/session` – validate token and return canonical `AuthUser`.
  - API auth helpers in `core/auth/api-auth.ts`:
    - `getAuthenticatedUser`, `requireAuth`, `requireRole` + role-specific guards.
  - Route protection via `middleware.ts` + `core/auth/routeAccess.ts`:
    - Configurable route → allowed roles mapping.
    - Default routes per role (e.g. admin → `/dashboard/admin`, scanner → `/scanner`, parent → `/parent`).

- **Roles**
  - Core roles defined as **arrays** on `AuthUser`:
    - `SUPER_ADMIN`, `ADMIN`, `SCANNER`, `TEACHER`, `STAFF`, `PARENT`.

## 3. Login UI Design

- **Location**
  - Layout: `src/app/(auth)/layout.tsx`.
  - Page: `src/app/(auth)/login/page.tsx`.

- **Visual design**
  - Based on the **SSC logo** color scheme:
    - Primary deep green (`#1B4D3E`) for headings and primary button.
    - Academic gold (`#F4B400`) for card top border and focus highlights.
    - Soft mint background (`#f0fdf4`) for the auth layout.
  - Centered card with:
    - School logo image (`/basic-ed-logo.png`).
    - Heading: "Welcome Back".
    - Subheading: "Unified School Management System".
  - Form fields:
    - Email/Username field with `User` icon.
    - Password field with `Lock` icon and show/hide toggle (`Eye` / `EyeOff`).
    - Sign-in button with loading spinner (UI only; no auth wired yet).

- **Copy & messaging**
  - Restricted access notice:
    - "Access is restricted to authorized staff and parents. Contact the Super Admin for account issues."
  - Footer text:
    - "© {current year} Green Valley College Foundation Inc. All rights reserved."

## 4. Branding & Meta Updates

- **Tab titles**
  - Global metadata in `src/app/layout.tsx`:
    - `title: "GVCFI-SSC"`.
    - `description: "Green Valley College Foundation Inc. – Supreme Student Council Systems"`.
  - Auth layout metadata in `src/app/(auth)/layout.tsx`:
    - `title: "Login | GVCFI-SSC"`.
    - Description mentioning Green Valley College Foundation Inc.

- **Logo usage**
  - Login page uses `public/basic-ed-logo.png` as the header logo.

- **Favicon / tab icon**
  - Metadata `icons.icon` set to `"/gvcfi.ico"`.
  - `public/gvcfi.ico` copied to `src/app/favicon.ico` so that the Next.js default favicon is replaced.

## 5. Current State & Next Steps

- **Current state**
  - Project has a **domain-driven folder structure** and **auth design spec** documented.
  - Login page UI is implemented visually and set as the default entry point via `/` → `/login` redirect.
  - Branding (titles, logo, favicon, footer school name) uses **GVCFI-SSC / Green Valley College Foundation Inc.**.

- **Recommended next steps**
  - Implement Supabase client utilities in `core/db`.
  - Implement auth services and context (`AuthService`, `SessionService`, `AuthContext`, `useAuth`).
  - Implement `/api/auth/login`, `/api/auth/logout`, `/api/auth/session` according to `AUTH_LOGIN_SYSTEM.md`.
  - Add `middleware.ts` + `routeAccess` config for role-based route protection.
  - Start with a vertical slice (e.g. SEMS event creation + scanner sync) using the new `modules/` structure.

## 6. Sidebar User Menu & Manage Users UI (This Chat)

- **Sidebar profile dropdown**
  - Replaced static logout button in `DashboardShell` with a shadcn `DropdownMenu` attached to the profile card.
  - Options: **Profile** (`/profile`), **Manage Users** (`/users`), **Logout** (calls `logout()`), with styling aligned to the app theme (`#1B4D3E`, soft neutrals).
  - Avatar shows user initial, name, and email; responsive behavior for collapsed sidebar.

- **Manage Users page (`/users`)** 
  - New route: `src/app/(dashboard)/users/page.tsx` using shadcn components (`Dialog`, `DropdownMenu`, `Select`, `Switch`, `Table`, `Badge`, `Avatar`).
  - Displays user list (mock data for now) with search, role filter, status filter and role-colored badges.
  - Row actions via dropdown:
    - **Reset Password** – dialog to send reset link.
    - **Update Role** – dialog showing current role and selecting a new one.
    - **Disable/Enable User** – dialog to toggle `isActive` with warning copy for disabling.
  - Uses `useAuth` helpers for `isSuperAdmin` / `isAdmin` to restrict who can manage which users.

- **User schema refactor: `app_users` vs `profiles`/`sis_users`**
  - Clarified roles of tables:
    - `auth.users` – Supabase auth identities.
    - `profiles` – legacy lightweight identity/audit table.
    - `sis_users` – previously intended as canonical app user table, but confusingly named.
  - Designed and implemented **Phase 1.2** migration to merge `profiles` + `sis_users` into a single canonical table **`app_users`** that:
    - Extends `auth.users` (PK = `auth.users.id`).
    - Stores `email`, `full_name`, `roles[]`, `primary_role`, `is_active`, `school_id`, audit columns.
    - Becomes the FK target for `created_by` / `updated_by` / `synced_by_user_id` across domain tables.
  - Migration steps include:
    - Creating `app_users` table and indexes.
    - Migrating data from `sis_users` and `profiles` when present.
    - Rewiring FKs on `facilities`, `events`, `students`, `sections`, `levels`, `event_sessions`, `attendance_logs` to point to `app_users`.
    - Enabling RLS on `app_users` with a read-only policy for authenticated users.

- **Auth routes refactor to `app_users`**
  - `/api/auth/login` now:
    - Authenticates via Supabase Auth (`signInWithPassword`).
    - Looks up the canonical user in `app_users` **by `authResult.user.id`**, not by email.
    - Maps `app_users` row to `AuthUser` (id, email, fullName, `roles[]`, `primaryRole`, `schoolId`, `isActive`).
    - Sets HTTP-only cookies: `auth-token`, `user-id`, `user-roles`, optional `school-id`.
  - `/api/auth/session` now:
    - Validates the token via admin Supabase client.
    - Loads the same `app_users` row by id and returns an `AuthUser` snapshot.

- **RLS recursion bug & fix**
  - Initial RLS policy attempted to gate writes on `app_users` using a subquery against `app_users` itself:
    - Caused `42P17: infinite recursion detected in policy for relation "app_users"`.
    - Surfaced as `ACCOUNT_NOT_FOUND` during login even when the row existed.
  - Fix:
    - Dropped the recursive "Admins can manage app_users" policy in the database.
    - Updated `Phase_1.2_Merge_Users_Tables.sql` to **omit** that policy and keep only:
      - `ENABLE ROW LEVEL SECURITY` on `app_users`.
      - A safe SELECT policy: `Authenticated users can view app_users`.

- **Current status after this chat**
  - `app_users` is the single canonical app user table, wired to auth and domain FKs.
  - Login and session APIs use `app_users` by Supabase user id and work with RLS enabled.
  - Sidebar user menu and `/users` page UI are implemented and styled; `/users` currently uses mock data and is ready to be wired to `app_users`-backed APIs.
