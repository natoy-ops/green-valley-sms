# RBAC Guard Hardening Summary

## Main Point
All SIS and user-management APIs now enforce the shared `requireRoles` guard, ensuring only administrative roles can reach sensitive operations while reusing a single authentication/authorization path.

## Key Details
- **SIS coverage**: Levels, sections, students CRUD plus CSV import/export now require `ADMIN_ROLES`, eliminating ad-hoc token parsing and guaranteeing consistent access control and audit context.
- **User management**: `/api/users/status` and `/api/users/reset-password` were refactored to the centralized guard, preventing self-status toggles from bypassing the check and keeping password resets restricted to admins.
- **Operational safety**: Every updated route now short-circuits with the standardized error responses from `requireRoles`, aligning runtime behavior with the documented role matrix in `docs/backend-api-endpoints.md`.
