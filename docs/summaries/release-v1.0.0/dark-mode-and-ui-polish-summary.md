# Dark Mode & UI Polish Summary (Dashboard, SEMS, SIS, Facilities, Profile, Users)

## Scope

Refinements across dashboard and module UIs to fully align with the new green/gold theme, ensure dark‑mode readability, and centralize theme switching in the user menu.

## Changes

- **Global / Shell**
  - Moved theme switching into the **user dropdown** in `DashboardShell` using `next-themes`.
  - Added `Theme` chips (Light / Dark / System) in the user menu and removed the standalone `ThemeToggle` button from the dashboard header.

- **Dashboard (`/dashboard`)**
  - Ensured all cards use theme variables for backgrounds, borders, and text.
  - **Recent Events table**:
    - Added `pt-2 pb-4 px-4` padding to `CardContent` so the table no longer sits flush against the card edges.

- **SEMS (`/sems`)**
  - Updated the "List of Events" card header to use `bg-card/95` and `border-border/80` for better dark‑mode integration.
  - Restyled status pills in the events table:
    - `live`: subtle emerald background (`bg-emerald-500/15`), bright green text, and border, with pulse.
    - `completed`: neutral `bg-muted text-muted-foreground`.
    - `scheduled/others`: amber‑tinted background with readable amber text and border.

- **Facilities (`/facilities`)**
  - Card (grid) view:
    - Standardized card surface to `bg-card` for all facilities.
    - Encoded status via **borders** instead of full background fills:
      - `operational`: `border-emerald-300/70`.
      - `maintenance`: `border-amber-300/70`.
      - `out_of_service`: `border-red-300/70`.
      - default: `border-border/60`.
    - Switched card content text to `text-card-foreground` variants for consistent contrast.
  - Edit dialog primary button now uses `bg-primary text-primary-foreground hover:bg-primary/90`.

- **Profile (`/profile`)**
  - Converted all hardcoded grays and greens to theme‑aware classes (`bg-card`, `bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-primary`).
  - Ensured cards, inputs, and security/password section all respect dark mode.

- **Users (`/users`)**
  - Applied the same theme system as other modules:
    - Root background: gradient from `background` to `muted/30`.
    - Filters, table, dialogs: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`.
  - Restyled actions dropdown and dialog buttons to use `primary` / `destructive` tokens instead of hex colors.

## Outcome

- All main modules (Dashboard, SEMS, SIS, Facilities, Profile, Users) now use consistent, theme‑aware styling for light and dark modes.
- Status badges and cards in SEMS, Facilities, and Dashboard are readable on dark backgrounds and reflect semantic state through subtle tints and borders.
- Theme switching is centralized and more discoverable in the user dropdown, and legacy theme controls have been removed from the header.
