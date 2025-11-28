# SEMS Audience Filter UI & Behavior

## Context

- Module: SEMS Events Management page (`src/app/(dashboard)/sems/page.tsx`)
- Scope: Create Event dialog, specifically the **Audience Filter** and **Exclusions** UX
- Goal: Move from simple grade checkboxes to a robust, future‑proof audience targeting model with clear UI, include/exclude rules, and good explainability.

---

## Audience Data Model

- Introduced a versioned JSON model stored in `events.target_audience`:

  ```ts
  type AudienceRuleKind = "ALL_STUDENTS" | "LEVEL" | "SECTION" | "STUDENT";
  type AudienceRuleEffect = "include" | "exclude";

  interface EventAudienceConfig {
    version: 1;
    rules: AudienceRule[]; // union of ALL_STUDENTS, LEVEL, SECTION, STUDENT
  }
  ```

- Rules are evaluated conceptually as:
  - Start with an empty allowed set.
  - Apply **include** rules to add matching students.
  - Apply **exclude** rules to remove matching students (even if previously included).

- Frontend serializes this config into a hidden field:

  ```html
  <input
    type="hidden"
    name="audienceConfigJson"
    value={JSON.stringify(buildAudienceConfig())}
  />
  ```

  This makes the Create Event form backend‑ready without hard‑wiring the API yet.

---

## Audience Filter UI

### Modes

Four selectable modes, presented as Shadcn‑style chips with icons and tooltips:

1. **All Students**
   - Everyone is included (`ALL_STUDENTS` include rule).
   - Exclusions can still carve out levels/sections/students.

2. **By Level / Section**
   - Hierarchical picker based on SIS `levels` and `sections`.
   - Supports whole levels and/or specific sections inside levels.

3. **Specific Students**
   - Search & multi‑select individual students.
   - Ignores level/section, purely ID‑based.

4. **Mixed Selection**
   - Combines the above: levels, sections, and specific students in one config.

### Tooltips

- Implemented using a shared Shadcn tooltip component (`src/components/ui/tooltip.tsx`).
- Theme‑aligned styling:
  - Background: `#1B4D3E`.
  - Text: white.
  - Arrow: `#1B4D3E`.
  - Width: `w-fit` so it tightly matches the content.
- Each mode explains its behavior, e.g. **Mixed Selection**: “Combine levels/sections and specific students into a single audience rule.”

### Summary Badge

- A live summary badge on the right of the Audience Filter header shows a human‑readable description, e.g.:
  - `All students`
  - `Grade 10, Grade 11: Section A, B + 3 specific student(s)`
  - `All students except 1 section(s)`

This is derived from the same state that builds `EventAudienceConfig`, so the UI and JSON remain in sync.

---

## Level / Section Selection

- Data source:
  - `GET /api/sis/levels` returns `LevelDto[]` + `SectionDto[]`.
  - Loaded once on dialog open.

- UI behaviors:
  - Each level row:
    - Expand/collapse arrow.
    - Tri‑state checkbox:
      - **Checked**: all sections selected.
      - **Indeterminate**: some sections selected.
      - **Unchecked**: none selected.
    - Section count indicator.
  - Expanding a level shows its sections with individual checkboxes.

- Rule construction:
  - Fully selected levels → one `LEVEL` include rule with `levelIds`.
  - Partially selected sections → one `SECTION` include rule with `sectionIds` that belong to non‑fully selected levels.

---

## Specific Students Picker

- Data source:
  - `GET /api/sis/students` with level/section join for display (`grade`, `section`).
  - Loaded lazily when:
    - Audience mode is **Specific Students** or **Mixed**, or
    - Exclusions panel is opened (needed for exclude‑students search).

- UI behaviors:
  - Search input above a scrollable list:
    - Filters by name, LRN, grade, or section.
    - Shows the first 50 matches with a hint if results are truncated.
  - Each row:
    - Checkbox + student name + `grade - section` + LRN.
  - Footer chip shows count: `N student(s) selected`.

- Rule construction:
  - Selected students contribute a single `STUDENT` include rule with `studentIds`.

---

## Exclusions Panel

### General

- Toggle: **Add exclusions (optional)** / **Hide exclusions** beneath the main audience area.
- Panel explains that excluded items are not allowed even if they match include rules.
- Tracks and surfaces counts in the summary badge (e.g. “excluding 2 section(s)”).

### Exclude Levels

- Levels rendered as small toggle chips.
- Clicking a chip adds/removes a level ID from `excludedLevelIds`.
- Generates a `LEVEL` exclude rule in the config.

### Exclude Sections (Search‑based)

- Replaced simple dropdown with a search UX for parity with students:
  - Search input: `Search sections to exclude...`.
  - Scrollable results list (40 max shown):
    - Each row shows `LevelName - SectionName`.
    - Clicking toggles that section in `excludedSectionIds`.
    - Selected rows highlighted with red background.
  - Empty states:
    - No sections loaded.
    - No matches for search query.
- Below the list, badges show current exclusions:
  - `LevelName - SectionName ×` (click to remove).

### Exclude Students (Search‑based)

- Mirrored UX to **Specific Students**, but for exclusions:
  - Search input: `Search students to exclude...`.
  - Scrollable list (30 max) filtered by name, LRN, grade, section.
  - Clicking a row toggles membership in `excludedStudentIds`.
  - Selected rows highlighted.
- Below the list, badges show excluded students:
  - `Student Name ×` (click to remove).

- Both sections and students exclusions emit `SECTION` and `STUDENT` exclude rules respectively.

---

## Implementation Notes

- All heavy lists (levels, sections, students) are fetched once and cached in state for the dialog lifetime.
- Audience state is entirely front‑end and lives inside `EventsPage`; no backend writes have been wired yet.
- The model (`EventAudienceConfig`) is extensible for future rule kinds (e.g., tags, programs, staff audiences) without changing the existing UI structure.
