# Core Layer

Cross-cutting platform concerns shared across all modules.

- `config/` – environment, routes, global config
- `db/` – Supabase/Postgres clients and DB utilities
- `auth/` – authentication, RBAC, permission checks
- `http/` – HTTP helpers, API response envelope, fetch wrappers
- `errors/` – base ApplicationError and mappers
- `logger/` – logging utilities
- `offline/` – IndexedDB and sync strategies (offline-first SEMS)
- `types/` – shared base types and global declarations
