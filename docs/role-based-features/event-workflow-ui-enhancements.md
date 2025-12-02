# Event Workflow UI Enhancements

## Summary

Implemented frontend UI enhancements for the event management workflow in `src/app/(dashboard)/sems/page.tsx`.

## Completed Features

### 1. Bulk Approve Action
- Added **Approve** button (green check icon) visible only to `SUPER_ADMIN` and `ADMIN` roles
- Enabled only when all selected events have `pending_approval` status
- Calls `PUT /api/sems/events` with `workflowAction: "APPROVE"`

### 2. Bulk Publish Action
- Added **Publish** button (blue megaphone icon) visible only to `SUPER_ADMIN` and `ADMIN` roles
- Enabled only when all selected events have `approved` status
- Calls `PUT /api/sems/events` with `workflowAction: "PUBLISH"`

### 3. Delete Action Visibility
- **Delete** button (red trash icon) now hidden from non-admin users
- Previously visible to all users; now restricted to `SUPER_ADMIN` and `ADMIN`

### 4. User-Friendly Lifecycle Labels
- Replaced technical enum values with readable labels:
  - `draft` → "Draft"
  - `pending_approval` → "Pending approval"
  - `approved` → "Approved"
  - `published` → "Published"
  - `completed` → "Completed"
  - `cancelled` → "Cancelled"

### 5. Lifecycle Status Badges
- Added colored pill-style badges for each lifecycle status
- Theme-aware styling (works in both light and dark modes):
  - **Draft**: muted/gray
  - **Pending approval**: amber/yellow
  - **Approved**: emerald/green
  - **Published**: sky/blue
  - **Completed**: slate/gray
  - **Cancelled**: red

### 6. Tooltips for Admin Actions
- Added shadcn `Tooltip` components to all three admin-only icons:
  - "Approve selected events"
  - "Publish selected events"
  - "Delete selected events"

## Key Implementation Details

### State Variables Added
- `isApprovingEvents` – loading state for approve action
- `isPublishingEvents` – loading state for publish action

### Memoized Flags Added
- `isAdminUser` – checks if current user has `SUPER_ADMIN` or `ADMIN` role
- `hasOnlyPendingApprovalSelected` – enables Approve button
- `hasOnlyApprovedSelected` – enables Publish button

### Utility Functions Added
- `formatLifecycleStatus()` – converts enum to display label
- `getLifecycleBadgeClasses()` – returns Tailwind classes for badge styling
