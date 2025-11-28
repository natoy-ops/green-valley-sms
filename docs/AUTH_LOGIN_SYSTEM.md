# Unified School Management System – Authentication & Login Design

## 1. Overview

- **Stack**
  - Next.js App Router (single app, role-based surfaces)
  - Supabase Auth for email/password (and future SSO) + session management
  - Server-side Supabase **admin client** for privileged operations
  - Client-side Supabase **browser client** for session awareness and optional optimizations
  - Custom `AuthService`, `SessionService`, `AuthContext`/`useAuth` for frontend integration
  - Route protection via `middleware.ts` + role/access map
  - Server-side helpers for API auth & RBAC

- **High-level flow**
  - User visits `/login` and submits email/password.
  - Client calls `/api/auth/login`.
  - API route validates credentials with Supabase Auth and loads profile from `app_users` table.
  - API sets **HTTP-only cookies** carrying auth token and role information.
  - Client optionally initializes Supabase session; `AuthContext` holds the current user snapshot.
  - Middleware uses cookies to protect routes and apply role-based redirects.
  - Session service maintains long-lived sessions suitable for school staff/parent usage.

- **Primary user roles (extensible)**
  - `SUPER_ADMIN` – system owner, full access, tenant-level config.
  - `ADMIN` – school admin; manage events, students, reporting.
  - `SCANNER` – restricted SEMS scanner access only.
  - `TEACHER` – class/subject ownership, classroom attendance, grades.
  - `STAFF` – non-teaching staff.
  - `PARENT` – parent/guardian, limited to own wards and communication.

All roles are represented by **role arrays** rather than a single role string.

---

## 2. Supabase Clients

### 2.1 Browser client (`src/core/db/supabase-client.browser.ts`)

- Creates a **browser-side Supabase client** using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Responsibilities:
  - Provide `supabase` instance for client-only features (e.g. real-time, optional session awareness).
  - Persist Supabase session in `localStorage` under a project-specific key (e.g. `usms-auth-session`).
- Config:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: false`

- Implementation notes:
  - Exported through a lazy-initialized singleton or `Proxy` to avoid initialization during SSR.
  - **Browser-only**; do not import in server components or API routes.

### 2.2 Admin / server client (`src/core/db/supabase-client.admin.ts`)

- Creates a **server-side admin client** with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Responsibilities:
  - Bypass RLS for controlled internal queries (e.g. lookup in `app_users` on login).
  - Validate access tokens and load canonical user record.

- Usage:
  - Auth API routes (`/api/auth/*`).
  - `api-auth` helpers for other API routes.
  - Should **never** be exposed to the browser.

- Implementation notes:
  - Use per-request clients in login/logout flows to avoid shared-session bleed.
  - For read-only helpers (e.g. `getUserById`), can reuse a global admin client.

---

## 3. Auth Service (Client-Side)

Location: `src/core/auth/AuthService.ts`

- Single abstraction over client-side auth interactions.
- Key responsibilities:
  - **Login** via custom API.
  - **Logout** and local cleanup.
  - **Get current user** using Supabase session + server validation.
  - Helpers for **role checks**.

### 3.1 `AuthUser` model

- Represents the logged-in principal:
  - `id: string`
  - `email: string`
  - `fullName: string`
  - `roles: UserRole[]` (primary access control data)
  - `primaryRole: UserRole` (first in roles array)
  - `schoolId: string | null` (for multi-school/tenant scenarios)
  - `isActive: boolean`
  - Optional projections (non-sensitive): `grade`, `section` (for student/parent), `staffNumber`, etc.

### 3.2 `login(credentials)`

- Input: `{ email: string; password: string; }`.
- Behavior:
  - Calls `POST /api/auth/login` with JSON body.
  - Uses `AbortSignal.timeout(15000)` for a 15s timeout.
  - Wrapped in retry helper **only** for network/5xx errors (no retry on 4xx).
  - Expects response shape:
    - `{ success: true, data: { user: AuthUser, session?: SupabaseSession }, meta: { ... } }`.
  - If `session` is present:
    - Calls `supabase.auth.setSession({ access_token, refresh_token })`.
    - Failures are logged, but cookies remain source of truth.
  - Returns `user` (`AuthUser`).

- Error behavior:
  - Maps network errors and timeouts to domain-specific `AppError` messages (e.g. "Unable to reach server").
  - 401/403 responses become `AppError` with user-friendly messages (e.g. invalid credentials, inactive account).

### 3.3 `getCurrentUser()`

- Steps:
  1. Uses browser Supabase client `supabase.auth.getSession()`.
  2. If no session → returns `null`.
  3. If a session exists, calls `/api/auth/session` with `Authorization: Bearer <access_token>`.
  4. On 200 → returns `AuthUser`.
  5. On 401/403 → treats as unauthenticated, returns `null`.
  6. On 5xx/network → throws to allow caller to retry.

- Retries:
  - At most 2 quick retries for transient server errors.

### 3.4 Logout & role helpers

- `logout()`:
  - Calls `POST /api/auth/logout` to clear cookies server-side.
  - Calls `supabase.auth.signOut()` for local session.
  - Returns void; caller clears UI state.

- Role helpers (used by `useAuth`):
  - `hasRole(user, allowedRoles)`.
  - Higher-level helpers: `isSuperAdmin`, `isAdmin`, `isTeacher`, `isScanner`, `isParent`.

---

## 4. Session Service (Client-Side)

Location: `src/core/auth/SessionService.ts`

- Manages client-side session metadata and activity tracking.

### 4.1 Configuration

- Example constants:
  - `SESSION_KEY = 'usms_session_meta'`.
  - `SESSION_TIMEOUT_MINUTES = 720` (12 hours, configurable).
  - `AUTO_LOGOUT_ENABLED = false` by default (school staff often stay logged in on dedicated devices).

### 4.2 Initialization

- `initialize()` is called once from `AuthContext` on app mount:
  - Subscribes to `supabase.auth.onAuthStateChange`:
    - `SIGNED_OUT` → clear session metadata.
    - `SIGNED_IN` / `TOKEN_REFRESHED` → update `lastActivity` and log.
  - Starts inactivity tracking listeners (`mousedown`, `keydown`, `scroll`, `touchstart`).
  - Optionally starts periodic token refresh guard.

### 4.3 Inactivity & refresh

- Inactivity:
  - Tracks `lastActivity` timestamp in `localStorage`.
  - If `AUTO_LOGOUT_ENABLED` is turned on later, can trigger logout when timeout is exceeded.

- Token refresh:
  - For safety, Supabase auto-refresh is usually sufficient.
  - Optionally add a watchdog that calls `supabase.auth.refreshSession()` at a safe interval.

---

## 5. Auth Context & `useAuth` Hook

### 5.1 `AuthContext` (`src/core/auth/AuthContext.tsx`)

- Provides global auth state to React components:
  - `user: AuthUser | null`
  - `loading: boolean`
  - `login(email, password)`
  - `logout()`
  - `refreshUser()`
  - `isAuthenticated: boolean`

- Lifecycle:
  - On mount:
    - Calls `SessionService.initialize()`.
    - Calls `loadUser()` → `AuthService.getCurrentUser()`.
  - `login()`:
    - Delegates to `AuthService.login`.
    - Sets `user` on success.
    - Performs hard navigation to entry route (e.g. `/`), letting middleware enforce role-based redirect.
  - `logout()`:
    - Calls server logout + `AuthService.logout()`.
    - Clears state and redirects to `/login`.

### 5.2 `useAuth` hook (`src/shared/hooks/useAuth.ts`)

- Thin wrapper exposing context with role helpers:
  - `hasRole(roles)`.
  - `isSuperAdmin`, `isAdmin`, `isTeacher`, `isScanner`, `isParent`.
  - Higher-level guards like: `canManageEvents`, `canViewFinance`, `canScanEvents`, `canAccessParentPortal`.

- Used by UI components and route-specific guards (client-side only, e.g. conditional rendering menus).

---

## 6. Server-Side Auth API

### 6.1 Login API (`src/app/api/auth/login/route.ts`)

- Endpoint: `POST /api/auth/login`.
- Responsibilities:
  1. Validate request body (`email`, `password`).
  2. Look up user in **app_users table** using admin Supabase client:
     - Select `id, email, full_name, roles, is_active, school_id, primary_role`.
  3. Ensure `is_active === true` and account is not locked/suspended.
  4. Verify credentials via Supabase Auth `signInWithPassword` using service role client.
  5. Normalize roles:
     - Ensure `roles` is a non-empty array.
     - Determine `primaryRole` (first in array, or a specific field if present).
  6. Optionally update `last_login_at` and `last_login_ip`.
  7. Set **HTTP-only cookies** with auth data:
     - `auth-token` → Supabase `access_token`.
     - `user-id` → user id.
     - `user-roles` → JSON array of roles.
     - Optionally `school-id` for multi-school.
  8. Return normalized response:
     - `{ success: true, data: { user, session }, meta: { timestamp, requestId } }`.

- Cookie options:
  - `httpOnly: true`
  - `secure: process.env.NODE_ENV === 'production'`
  - `sameSite: 'lax'`
  - `path: '/'`
  - `maxAge: 12h` (aligned with `SESSION_TIMEOUT_MINUTES`)

- Error handling:
  - Invalid credentials → `401` with generic message, no user enumeration.
  - Inactive account → `403` with admin-contact guidance.
  - Misconfiguration → `500` with generic error.
  - All errors wrapped in application-level error response consistent with project API format.

### 6.2 Logout API (`src/app/api/auth/logout/route.ts`)

- Endpoint: `POST /api/auth/logout`.
- Behavior:
  - Clears auth-related cookies by setting past expiry.
  - Response: `{ success: true, data: { message: 'Logout successful' } }`.

### 6.3 Session API (`src/app/api/auth/session/route.ts`)

- Endpoint: `GET /api/auth/session`.
- Behavior:
  - Extracts `Authorization: Bearer <token>` or `auth-token` cookie.
  - Validates token via `supabaseAdmin.auth.getUser(token)`.
  - Loads canonical user from `app_users` table.
  - Returns `AuthUser` on success, `401`/`403` on failure.

---

## 7. API Auth Utilities

Location: `src/core/auth/api-auth.ts`

- Goal: standardize how API routes enforce authentication & authorization.

### 7.1 `getAuthenticatedUser(request)`

- Reads, in order:
  1. `user-id` cookie (fast path) + verifies user is active in DB.
  2. If missing, tries `auth-token` cookie or `Authorization` header.
- If no valid identity → returns `null`.
- If user inactive → throws application error with `403`.

### 7.2 `requireAuth(request)`

- Wrapper over `getAuthenticatedUser`.
- Throws application error (`401`) if user is missing.
- Returns `AuthUser` if valid.

### 7.3 Role guards

- `requireRole(request, allowedRoles)`.
- Convenience wrappers:
  - `requireAdmin(request)`.
  - `requireSuperAdmin(request)`.
  - `requireTeacher(request)`.
  - `requireScanner(request)` (for SEMS endpoints).

---

## 8. Route Protection & Role-Based Access

### 8.1 Middleware (`src/middleware.ts`)

- Runs for all **app routes** except static assets and public paths.

#### 8.1.1 Public vs protected routes

- Public routes include:
  - `/login`
  - `/forgot-password` (future)
  - Static marketing pages under `(public)` route group.
- App/API-specific exceptions can be configured if needed (e.g. webhooks).

#### 8.1.2 Authentication check

- Reads `auth-token` cookie:
  - If missing → redirect to `/login` for protected paths.
- Reads `user-roles` cookie (JSON array):
  - If invalid or empty → redirect to `/login`.

#### 8.1.3 Authorization check

- Uses `ROUTE_ACCESS_RULES` (`src/core/auth/routeAccess.ts`). Examples:
  - `/dashboard/admin` → `SUPER_ADMIN`, `ADMIN`.
  - `/dashboard/teacher` → `TEACHER`, `ADMIN`, `SUPER_ADMIN`.
  - `/scanner` → `SCANNER`, `ADMIN`, `SUPER_ADMIN`.
  - `/parent` → `PARENT`.

- If user is not allowed for a path:
  - Determines their **default route** via `getDefaultRouteForRoles(roles)`.
  - Redirects there.

### 8.2 Route access config (`src/core/auth/routeAccess.ts`)

- Defines an array/map of `{ pathPrefix, allowedRoles }`.
- Provides helpers:
  - `canAccessRoute(path, roles)` → boolean.
  - `getDefaultRouteForRoles(roles)`;
    - Example defaults:
      - `SUPER_ADMIN` → `/dashboard/admin`.
      - `ADMIN` → `/dashboard/admin`.
      - `TEACHER` → `/dashboard/teacher`.
      - `SCANNER` → `/scanner`.
      - `PARENT` → `/parent`.

---

## 9. End-to-End Flows

### 9.1 Login flow (staff/teacher/admin)

1. User visits `/login`.
2. `AuthContext` initializes, calls `SessionService.initialize()` and `getCurrentUser()`.
3. If already authenticated, user is redirected to their default route.
4. Otherwise, user submits email/password.
5. `AuthContext.login` calls `AuthService.login` → `/api/auth/login`.
6. API validates credentials, sets cookies, returns `AuthUser` + session.
7. Client optionally initializes Supabase session.
8. `AuthContext` sets `user` and performs hard navigation (`window.location.href = '/'`).
9. Middleware runs, sees cookies, checks route access, and routes to correct dashboard.

### 9.2 Login flow (scanner)

- Same as above, but typical default route is `/scanner` and UI is optimized for kiosk/mobile.
- Scanner UI uses `useAuth` + role checks to ensure only allowed roles see scanning tools.
- Offline scanning logic is handled separately in SEMS module; auth token is still required to **sync**.

### 9.3 Login flow (parent)

- Parents log in via same `/login` endpoint or a dedicated alias (e.g. `/parent/login`).
- On successful login with `PARENT` role, `getDefaultRouteForRoles` sends them to `/parent` where:
  - They see child profiles, attendance summaries, grades, and communication threads.

### 9.4 Logout

1. User clicks Logout.
2. UI calls `useAuth().logout()`.
3. `AuthContext.logout`:
   - Calls `/api/auth/logout` to clear cookies.
   - Calls `AuthService.logout` to sign out from Supabase.
   - Clears `user` state and local metadata.
   - Redirects to `/login`.

---

## 10. Security & Operational Notes

- **Credentials are only checked on the server** via Supabase Auth.
- **HTTP-only cookies** ensure tokens and role data are not accessible from JS.
- **Multi-role support** allows flexible permission modeling as modules grow.
- **Account flags** (`is_active`, potential `must_change_password`, `account_locked`) can be enforced during login and API access.
- **Auditability**: login attempts can be logged to an `audit_logs` table for compliance.
- **CSRF**: `sameSite: 'lax'` reduces risk; for sensitive POST endpoints, anti-CSRF tokens can be added later.
- **Future enhancements**:
  - SSO integration (e.g. with school’s identity provider).
  - 2FA for admin/super-admin users.
  - Parent-specific password reset flows.
