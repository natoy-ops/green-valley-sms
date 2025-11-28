# SEMS Session Configuration UI Changes

## Context

- Module: **SEMS Events Management** (`src/app/(dashboard)/sems/page.tsx`)
- Feature: Create Event dialog – **Session Configuration** section
- Goal: Support flexible, per-session and per-date attendance windows with clear UX.

---

## Session Model

### Core concepts

- **Session Periods**
  - `morning`, `afternoon`, `evening`
- **Session Direction**
  - `in` (entry)
  - `out` (exit)
- **AttendanceSessionConfig** (per session, per date)
  - `id`: stable key (e.g. `"morning-in"`, `"afternoon-out"`)
  - `period`: `"morning" | "afternoon" | "evening"`
  - `direction`: `"in" | "out"`
  - `name`: display label (e.g. `"Morning In"`)
  - `supportsLateAfter`: `true` for entry sessions, `false` for exit sessions
  - `opens`: `HH:mm` local time – first accepted scan for this session
  - `lateAfter`: `HH:mm` local time – cut-off for *on time* (optional, only used when `supportsLateAfter` is `true`)
  - `closes`: `HH:mm` local time – last accepted scan for this session

### Default sessions

The UI bootstraps with a fixed set of six sessions:

- **Morning**
  - `Morning In` (`morning-in`, entry, `supportsLateAfter = true`)
  - `Morning Out` (`morning-out`, exit)
- **Afternoon**
  - `Afternoon In` (`afternoon-in`, entry, `supportsLateAfter = true`)
  - `Afternoon Out` (`afternoon-out`, exit)
- **Evening**
  - `Evening In` (`evening-in`, entry, `supportsLateAfter = true`)
  - `Evening Out` (`evening-out`, exit)

Exit sessions (`* Out`) do **not** use `Late After`; the UI shows a read-only hint instead.

---

## Per-Date Configuration

### DateSessionConfig

To support different schedules per date within a range, the UI maintains a per-date config:

```ts
interface DateSessionConfig {
  date: string; // ISO YYYY-MM-DD
  enabledPeriods: Set<SessionPeriod>; // which periods are active on this date
  sessions: AttendanceSessionConfig[]; // full set of session rows with times
}
``

### Range → dates

- The Create Event form uses a **date range** (`DateRange`) from the calendar.
- It derives an ordered list of calendar days using `eachDayOfInterval`.
- For each day:
  - If a `DateSessionConfig` already exists, it is preserved.
  - Otherwise, a new config is created from the default sessions.
- The UI tracks a `selectedConfigDate` (ISO `YYYY-MM-DD`) that is currently being edited.

This allows:

- **Single-day events** – behave like a simple one-day schedule.
- **Multi-day events** – each date can have its own enabled periods and times.

---

## UI Behaviour

### Session Configuration section

- Title: **Session Configuration**
- Helper copy: explains that this area controls time windows and late thresholds per session.

#### Same schedule checkbox

For **multi-day ranges** only, the UI shows:

> `☑ Use the same session schedule for every day in this date range`

Semantics:

- When the checkbox is **turned ON**:
  - The currently selected date's `DateSessionConfig` becomes the **template**.
  - All other days in the range receive a deep copy of:
    - `enabledPeriods`
    - `sessions` (session rows + times)
  - Subsequent edits to periods or times are **broadcast to every date**.
- When the checkbox is **OFF**:
  - Each date's `DateSessionConfig` is independent.
  - Edits only affect the currently selected date.

#### Date selector

Shown only when the range has more than one date.

- **If "same schedule" is ON**:
  - The selector shows a **single combined pill** summarising the range, e.g.:
    - `THU – FRI`
    - `Nov 27 – Nov 28, 2025`
    - `3 periods`
  - Clicking the pill selects the first date internally (used as the edit target).
  - The period count is derived from the currently selected `DateSessionConfig`.

- **If "same schedule" is OFF**:
  - The selector shows **one pill per date**:
    - Day of week (`THU`), date (`Nov 27`), number of enabled periods (`3 periods`).
  - Clicking a pill updates `selectedConfigDate` and loads that date's configuration into the editor.

#### Period toggles

Within the editor for the current date (or range, if same-schedule is ON):

- Horizontal chip group: `Morning`, `Afternoon`, `Evening`.
- Toggling a chip updates `enabledPeriods`:
  - ON → all sessions for that period (In + Out) become visible/editable.
  - OFF → those sessions are hidden and excluded from the payload.
- If same-schedule is ON, the toggle applies across **all** dates in the range.

#### Session rows

For each enabled session (`Morning In`, `Morning Out`, etc.):

- Header row:
  - Session name (`Morning In`).
  - Small badge: `Entry` or `Exit`.
- 3-column grid:
  - **Opens** – `TimePicker` with tooltip:
    - "The earliest time a student can scan for this session and be counted. Scans before this time are not included in this session."
  - **Late After** – `TimePicker` (entry sessions only), tooltip:
    - "The cut-off time for being on time. Students who scan after this time, but before \"Closes\", will be marked as late for this session."
    - For exit sessions, this column shows disabled text: "Not applicable for exit sessions".
  - **Closes** – `TimePicker` with tooltip:
    - "The last time this session accepts scans. Scans after this time will be treated as part of the next session, if there is one, or may be rejected."

When **same-schedule** is ON, editing any of these times updates the corresponding session in every `DateSessionConfig`.

---

## Form Payload

The Create Event form exposes the configuration to the backend as a hidden field:

```tsx
<input
  type="hidden"
  name="sessionConfigJson"
  value={buildSessionConfigJson()}
/>
```

### JSON shape (version 2)

```json
{
  "version": 2,
  "dates": [
    {
      "date": "2025-11-28",
      "sessions": [
        {
          "id": "morning-in",
          "name": "Morning In",
          "period": "morning",
          "direction": "in",
          "opens": "08:00",
          "lateAfter": "08:30",
          "closes": "09:00"
        },
        {
          "id": "morning-out",
          "name": "Morning Out",
          "period": "morning",
          "direction": "out",
          "opens": "11:30",
          "lateAfter": null,
          "closes": "12:00"
        }
      ]
    },
    {
      "date": "2025-11-29",
      "sessions": [
        {
          "id": "evening-in",
          "name": "Evening In",
          "period": "evening",
          "direction": "in",
          "opens": "18:00",
          "lateAfter": "18:15",
          "closes": "19:00"
        }
      ]
    }
  ]
}
```

Notes:

- Each date only includes sessions for its **enabled periods**.
- `lateAfter` is `null` when either:
  - The session does not support a late threshold (exit sessions), or
  - The user left the field empty.

---

## Behavioural Semantics (for backend / scanner)

Given a student's scan time `t` and a `DateSessionConfig` for that calendar date:

1. Find the first session where `opens <= t < closes`.
2. If `supportsLateAfter` and `lateAfter` is set:
   - `t <= lateAfter` → student is **on time** for that session.
   - `lateAfter < t < closes` → student is **late** for that session.
3. If `t >= closes` for all sessions on that date, the scan either:
   - Falls into the next date's sessions, or
   - Is treated as out-of-window (implementation detail for the backend).

This model supports:

- Morning-only / afternoon-only / evening-only days.
- Mixed schedules across a range (e.g. 1st day morning-only, 2nd day evening-only).
- A single unified schedule applied to all days in a range via the checkbox.
