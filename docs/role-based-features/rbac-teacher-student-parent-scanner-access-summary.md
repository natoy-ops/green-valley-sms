# RBAC Updates: Roles, Navigation, and Permissions

## Main Point

Expand the role-based access model so that **teachers, students, scanners, and parents** have tailored navigation and backend permissions, and fix the multi-role management UX for updating user roles.

## Key Changes

- **Manage Users: Update Role Dialog**
  - Button is now enabled when **either** primary role or assigned roles change.
  - Assigned roles are managed via badges with remove (X) actions.
  - Success toast now reflects **primary role and full roles array** after update.

- **Sidebar Navigation (DashboardShell)**
  - Added **Student → My Events** nav item (visible for `STUDENT`, links to `/sems/student-events`).
  - Added **Scanner → Scan Event** nav item (visible for `SCANNER`, links to `/sems/scan`).
  - Added **Parent → School Events** nav item (visible for `PARENT`, links to `/sems/parent-events`).
  - Teachers can now see the following modules:
    - **Dashboard** (`/dashboard`)
    - **Events** (`/sems`)
    - **Registry** (`/sis`)
    - **Facilities** (`/facilities`)

- **Route Access Rules (`routeAccess.ts`)**
  - `/dashboard`, `/dashboard/teacher`, `/sems`, `/sis`, `/facilities` now allow `TEACHER` alongside `SUPER_ADMIN` and `ADMIN`.
  - Student/parent/scanner SEMS routes have dedicated rules:
    - `/sems/student-events` → `STUDENT`
    - `/sems/parent-events` → `PARENT`
    - `/sems/scan` → `SCANNER`, `SUPER_ADMIN`, `ADMIN`.

- **Role Config (`config/roles.ts`)**
  - Introduced `ADMIN_TEACHER_ROLES = ["SUPER_ADMIN", "ADMIN", "TEACHER"]`.
  - Expanded `SUPPORTED_APP_ROLES` to include `TEACHER` so the app recognizes teacher accounts as fully supported users.

- **API Access: Dashboard & Profile**
  - `/api/dashboard` `GET` now uses `ADMIN_TEACHER_ROLES` so teachers can load dashboard data.
  - `/api/profile` already allows all app roles to fetch profile data; only admins can change roles/activation.

- **API Access: Events (SEMS)**
  - `/api/sems/events`
    - `GET` → `ADMIN_TEACHER_ROLES` (list events with filters).
    - `POST` → `ADMIN_TEACHER_ROLES` (create events).
    - `PUT` → `ADMIN_TEACHER_ROLES` (update events).
  - `/api/sems/events/[id]` `GET` → `ADMIN_TEACHER_ROLES` (view single event with facility for editing).
  - Scanner-focused endpoints continue to use `ADMIN_SCANNER_ROLES` where appropriate.

- **API Access: Registry (SIS)**
  - `/api/sis/students`
    - `GET` → `ADMIN_TEACHER_ROLES` (list students with level/section joins).
    - `POST` → `ADMIN_TEACHER_ROLES` (create students with fallback section handling).
    - `PATCH` → `ADMIN_TEACHER_ROLES` (update students, regenerate QR hash when ID changes).
  - `/api/sis/levels` `GET` → `ADMIN_TEACHER_ROLES`.
  - `/api/sis/sections` `GET` → `ADMIN_TEACHER_ROLES`.
  - Bulk import/export and other SIS operations remain **admin-only**.

- **API Access: Facilities**
  - `/api/facilities`
    - `GET` → `ADMIN_TEACHER_ROLES` (list facilities).
    - `POST` → `ADMIN_TEACHER_ROLES` (create facilities, tracking `created_by`).

## Overall Effect

- **Teachers** can now:
  - Access dashboard, events, registry, facilities, and profile modules in the UI.
  - Create and update **events**, **students**, and **facilities** via official APIs.
- **Students, parents, and scanners** have clear, role-specific SEMS entry points in the sidebar.
- Administrative-only operations (user management, bulk SIS tooling, critical mutations) remain restricted to **SUPER_ADMIN/ADMIN**.
