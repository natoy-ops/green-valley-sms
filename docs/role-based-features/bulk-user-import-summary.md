# Bulk User Import via Excel – Feature Summary

## Main Goal
Enable admins to bulk-create user accounts (students, teachers, staff, parents, scanners) from an Excel file, with automatic credential generation and secure distribution, while respecting existing RLS and auth constraints.

## Key Behaviors

- **Entry point**: `/users` page, header button **Import Users**.
- **Dialog**: "Import User Accounts" with:
  - Role selector (non-admin roles only: STUDENT, TEACHER, STAFF, PARENT, SCANNER).
  - File input for `.xlsx` / `.xls`.
  - Downloadable Excel template.
  - Info panel explaining temporary passwords + CSV export.

## Excel Template & Format

- Template route: `GET /api/users/import-students/template`.
- Worksheet: `Students`.
- Columns (row 1):
  - `Full Name`
  - `Email`
- Data rows (row 2+):
  - `Full Name`: required, free text.
  - `Email`: required, must be valid email; hyperlinks are supported.

## Import API

- Endpoint: `POST /api/users/import-students` (admin/service client).
- Payload: `multipart/form-data` with fields:
  - `file`: Excel file.
  - `role`: target `UserRole` (TEACHER, STUDENT, STAFF, PARENT, SCANNER).
- Processing steps per row:
  1. Validate headers (`Full Name`, `Email`) in first row.
  2. For each subsequent row:
     - Extract text from cells (handles plain text, hyperlinks, rich text).
     - Skip completely empty rows.
     - Validate `fullName` and `email` (presence + regex).
     - Deduplicate emails within the file.
     - Generate strong random password.
     - Create Supabase auth user (email, password, email confirmed).
     - Insert into `app_users` with:
       - `id` = auth user id
       - `email`, `full_name`
       - `roles` = `[selectedRole]`
       - `primary_role` = `selectedRole`
       - `is_active` = `true`
       - `created_by` = acting admin app_user id.

## Response Shape

- On success (`201`):
  ```json
  {
    "success": true,
    "data": {
      "summary": { "total": n, "created": c, "skipped": s },
      "credentials": [
        { "email": "user@example.edu", "temporaryPassword": "..." }
      ],
      "rowErrors": [
        { "row": 2, "email": "bad@example", "reason": "INVALID_EMAIL" },
        { "row": 3, "email": "dup@example.edu", "reason": "DUPLICATE_IN_FILE" },
        { "row": 4, "email": "used@example.edu", "reason": "EMAIL_IN_USE" },
        { "row": 5, "email": "x@y.edu", "reason": "APP_USER_INSERT_FAILED" }
      ]
    },
    "meta": { "timestamp": "..." }
  }
  ```

### Possible `reason` values

- `MISSING_REQUIRED_FIELDS` – missing full name or email.
- `INVALID_EMAIL` – email fails format check.
- `DUPLICATE_IN_FILE` – same email appears more than once in the uploaded sheet.
- `EMAIL_IN_USE` – Supabase auth already has this email.
- `AUTH_CREATE_FAILED` – other failure creating auth user.
- `APP_USER_INSERT_FAILED` – `app_users` insert violated constraints/RLS.
- `UNKNOWN_ERROR` – unexpected exception importing the row.

## UI: Post-Import Behavior

- After a successful import (at least one created row):
  - Toast: `Imported {created} of {total} user(s)`.
  - If `credentials` is non-empty, the client generates and auto-downloads a CSV:
    - Filename: `student-credentials-<timestamp>.csv` (can be generalized later).
    - Columns: `Email, Temporary Password`.

## RLS & Security

- `app_users` has RLS enabled with policies:
  - Authenticated users can insert/update **their own** row.
- Backend imports use the Supabase **service role** client and must bypass RLS.
- A dedicated policy was added (in Phase 1.7 migration):
  ```sql
  CREATE POLICY "Service role can manage app_users"
  ON app_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
  ```
  This allows the backend to insert/update `app_users` rows during imports while keeping strict rules for normal authenticated clients.

## Current Limitations / Future Enhancements

- No email delivery yet; credentials are distributed via the downloaded CSV.
- Import is **create-only**; existing auth/app_users are skipped, surfaced via `rowErrors`.
- All roles share the same simple template (`Full Name`, `Email`).
  - Future: extend templates per role (e.g., grade level, section, guardian mapping).
- UI currently surfaces only the summary; `rowErrors` are visible via API/Network tab.
  - Future: add an in-dialog “View details” panel listing row issues.
