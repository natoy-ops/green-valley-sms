---
description: Student & Parent account model, student_guardians linking, and import flow plan
---

# SEMS Student & Parent Linking – Design Notes

## 1. Context & Goals

We are introducing SEMS pages such as `/sems/student-event` that must show events relevant to:

- Students (self view)
- Parents/guardians (seeing events for their children)

Key requirements:

- Use **one consistent data model** to link SIS students to authenticated app users.
- Support **optional guardians** (a student can exist without a parent account).
- Keep imports **idempotent** and safe to re-run.
- Avoid extra manual steps for parent account creation where possible.

This document summarizes the existing schema, our chosen linking strategy, and how future imports should behave.

---

## 2. Existing Schema Overview

### 2.1 `students` table (core registry)

Defined in `Phase_1_Database_Schema.sql` and extended in `Phase_1.1_Database_Schema.sql`:

```sql
create table students (
  id uuid default gen_random_uuid() primary key,
  student_school_id text unique not null,
  first_name text not null,
  last_name text not null,
  section_id uuid references sections(id) on delete restrict,
  guardian_phone text,
  guardian_email text,
  qr_hash text unique not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table students
  add column if not exists created_by uuid references profiles(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamp with time zone;
```

**Nullability / notes:**

- `student_school_id`, `first_name`, `last_name`, `qr_hash` are **NOT NULL**.
- `section_id` is nullable.
- `guardian_phone` and `guardian_email` are **nullable** → guardian account truly optional.
- Audit columns `created_by`, `updated_by`, `updated_at` are nullable.

### 2.2 `student_guardians` table (link between SIS students and app users)

Defined in `Phase_1.7_Student_Guardian_Links.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.student_guardians (
    student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    app_user_id  UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    relationship TEXT,
    is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_by   UUID,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_by   UUID,
    CONSTRAINT student_guardians_pkey PRIMARY KEY (student_id, app_user_id)
);
```

**Nullability / notes:**

- `student_id` and `app_user_id` are **NOT NULL** (required for a link).
- `relationship` is nullable (e.g. `mother`, `father`, `guardian`, `self`).
- `is_primary` is **NOT NULL**, default `FALSE`.
- `created_at` / `updated_at` are **NOT NULL** with UTC defaults.
- `created_by` / `updated_by` are nullable audit fields.

**Implication:**

- A student can exist with **no `student_guardians` rows at all** → guardian truly optional.
- When we do create a link, we only need `student_id` and `app_user_id`; everything else is optional.

### 2.3 Existing SEMS usage

The SEMS `EventRepository` already has a helper to compute student contexts for a given `app_user_id`:

```ts
async getStudentContextsForUser(appUserId: string): Promise<StudentAudienceContext[]> {
  const { data, error } = await this.supabase
    .from("student_guardians")
    .select(
      `student_id, students:student_id ( section_id, sections:section_id ( level_id ) )`
    )
    .eq("app_user_id", appUserId);

  // ...maps to [{ studentId, sectionId, levelId }, ...]
}
```

This is the core building block for:

- Student view of their own events.
- Parent view of child events.

---

## 3. Linking Strategy (Option A)

We chose **Option A**: use `student_guardians` as the **only** link between SIS students and app users, for *both* students and parents.

### 3.1 Student accounts

When we eventually support student logins, the recommended approach is:

- Create a student app account (`auth.users` + `app_users`) with `primary_role = 'STUDENT'` and `roles` containing `"STUDENT"`.
- Immediately insert a **self-link** into `student_guardians`:

```sql
INSERT INTO student_guardians (
  student_id,
  app_user_id,
  relationship,
  is_primary,
  created_by
) VALUES (
  :student_id,           -- students.id
  :student_app_user_id,  -- app_users.id (role STUDENT)
  'self',
  TRUE,
  :created_by_app_user_id
)
ON CONFLICT (student_id, app_user_id) DO NOTHING;
```

Result:

- For a logged-in student, `getStudentContextsForUser(currentAppUser.id)` returns their own `studentId/sectionId/levelId`.

### 3.2 Parent/guardian accounts

For a parent/guardian app account (`primary_role = 'PARENT'`):

- `student_guardians` rows link each student to each parent account:

```sql
INSERT INTO student_guardians (
  student_id,
  app_user_id,
  relationship,
  is_primary,
  created_by
) VALUES (
  :child_student_id,     -- students.id of the child
  :parent_app_user_id,   -- app_users.id of the parent
  :relationship,         -- e.g. 'mother', 'father', 'guardian'
  :is_primary,
  :created_by_app_user_id
)
ON CONFLICT (student_id, app_user_id) DO NOTHING;
```

This supports:

- One parent → multiple children (same `app_user_id`, different `student_id`).
- One student → multiple parents (same `student_id`, different `app_user_id`).

### 3.3 Role-agnostic resolution

With Option A, the resolution path for **any** logged-in app user is:

1. Take `currentAppUser.id` from auth.
2. Call `getStudentContextsForUser(currentAppUser.id)`.
3. Use `studentId/sectionId/levelId` contexts to filter events.

This works for:

- Student accounts (via `relationship = 'self'`).
- Parent accounts (via guardian relationships).
- Future staff/guardian delegates if needed.

---

## 4. Bulk Import Flows

We have two relevant import experiences today:

1. **Bulk Import Students (SIS)** – `/sis` UI:
   - The UI lists **required columns**:
     - `ID / LRN` (student_school_id)
     - `First Name`
     - `Last Name`
     - `Grade / Level`
     - `Section`
   - The **Export template** button downloads a CSV with header row:
     - `ID / LRN`, `First Name`, `Middle Name`, `Last Name`, `Grade / Level`, `Section`, `Student Email`, `Guardian First Name`, `Guardian Middle Name`, `Guardian Last Name`, `Guardian Phone`, `Guardian Email`.
   - **Student Email** (optional): If provided and valid, the import will:
     1. Create an `auth.users` entry with a random temporary password.
     2. Create an `app_users` row with `primary_role = 'STUDENT'`.
     3. Insert a `student_guardians` self-link (`relationship = 'self'`, `is_primary = true`).
     4. Return the credentials in the response so they can be shared with students.
   - **Guardian Email** (optional): If provided and valid, the import will:
     1. Create an `auth.users` entry with a random temporary password.
     2. Create an `app_users` row with `primary_role = 'PARENT'`.
     3. Insert a `student_guardians` link (`relationship = 'guardian'`, `is_primary = true`).
     4. If multiple students share the same guardian email (siblings), only one parent account is created and linked to all students.
     5. Return the credentials in the response so they can be shared with guardians.
   - Guardian name columns (`Guardian First Name`, `Guardian Middle Name`, `Guardian Last Name`) are used to set the guardian's `full_name`. If not provided, defaults to "Guardian of [Student Name]".

2. **Import User Accounts (generic)** – `/users` UI, Excel with:
   - `Full Name`, `Email` and a chosen **Role to import** (Teacher, Student, Parent, etc.).
   - Currently only creates app accounts (`auth.users` + `app_users`) and does **not** link to SIS students.

### 4.1 Direction: students as the single source for parents

We agreed it is desirable to make the **Bulk Import Students** flow the *authoritative* operation for both:

- Creating/updating `students` rows.
- (Optionally) creating parent app accounts.
- Establishing links in `student_guardians`.

Reasoning:

- The student CSV already carries student identity + guardian contact.
- It simplifies operations: one SIS feed populates all SEMS-related identity.

### 4.2 Optional guardians and null handling

Given the current schema, we will apply the following rules per student CSV row:

- Always upsert the **student** row using `student_school_id` as the natural key.
- Treat `guardian_phone` and `guardian_email` as **optional**:
  - If `guardian_email` is **NULL or invalid**:
    - Do **not** create a parent app account.
    - Do **not** insert into `student_guardians`.
    - Student still imports successfully.
  - If `guardian_email` is present and valid:
    1. **Find or create** an `app_users` row keyed by email.
    2. If new, also create `auth.users` with a random temporary password.
    3. Insert a `student_guardians` row linking this student to this app user.

This keeps guardians optional while converging toward a linked model when data is available.

### 4.3 Idempotency considerations

- Re-running the same CSV should be safe:
  - Student upsert keyed by `student_school_id`.
  - Parent account lookup keyed by `email`.
  - `student_guardians` insert with `ON CONFLICT (student_id, app_user_id) DO NOTHING`.
- Multiple students sharing the same guardian email:
  - Reuses the same parent app user across rows.
  - Creates multiple `student_guardians` links (one per child).

---

## 5. `/sems/student-event` and parent pages

With the above linking strategy in place:

- For a **student landing page** (`/sems/student-event`):
  - Resolve `currentAppUser.id`.
  - Call `getStudentContextsForUser(appUserId)` → typically one context (self).
  - Query SEMS events whose audience matches that student/section/level.

- For a **parent landing page** (future, could share the same underlying API):
  - Resolve `currentAppUser.id` (role `PARENT`).
  - `getStudentContextsForUser(appUserId)` returns one context per linked child.
  - Events can be grouped by `studentId` in the response or UI.

The same repository method works for both roles because the link is purely via `student_guardians`.

---

## 6. Open Questions / Future Work

- **Student accounts:**
  - Current SIS CSV template does **not** include a `Student Email` column.
  - For now, focus on parents; later we can extend the template and create student logins with `relationship = 'self'` links.

- **Guardian relationship semantics:**
  - We may want a dedicated CSV column like `Guardian Relationship` to populate `student_guardians.relationship` (`mother`, `father`, `guardian`, etc.).
  - Today, `relationship` is nullable, so we can safely omit it initially.

- **UI for link management:**
  - Admin UIs to view/edit `student_guardians` (e.g., add a second guardian manually) are not yet designed.

---

## 7. Summary for Future Contributors

- `students` holds the SIS record; guardian-related fields here are **optional** and nullable.
- `student_guardians` is the **canonical link** between students and authenticated app users (parents, students, delegates).
- Guardians are optional at the DB level: a student may have zero `student_guardians` rows.
- Bulk Import Students is intended to evolve into the **single source of truth** for:
  - Creating/updating `students`.
  - Creating parent app accounts when guardian email is present.
  - Creating `student_guardians` links.
- SEMS queries for student/parent event visibility should consistently use `getStudentContextsForUser(appUserId)` and the `student_guardians` link table.
