# Backend API Endpoints

Comprehensive list of all Next.js API routes under `src/app/api`.

## Auth & Session
[ALL USERS]
- **POST** `/api/auth/login`
[ALL USERS]
- **POST** `/api/auth/logout`
[ALL USERS]
- **GET** `/api/auth/session`

## Dashboard & Profile
[SUPER_ADMIN, ADMIN]
- **GET** `/api/dashboard`
[SUPER_ADMIN, ADMIN, SCANNER]
- **GET** `/api/profile`
[SUPER_ADMIN, ADMIN, SCANNER]
- **PATCH** `/api/profile`
[SUPER_ADMIN, ADMIN, SCANNER]
- **POST** `/api/profile/password`

## Facilities Management
[SUPER_ADMIN, ADMIN]
- **GET** `/api/facilities`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/facilities`
[SUPER_ADMIN, ADMIN]
- **PATCH** `/api/facilities/[id]`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/facilities/availability`

## SEMS (Events & Scanners)
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sems/events`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/sems/events`
[SUPER_ADMIN, ADMIN]
- **PUT** `/api/sems/events`
[SUPER_ADMIN, ADMIN]
- **DELETE** `/api/sems/events`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sems/events/[id]`
[SUPER_ADMIN, ADMIN, SCANNER]
- **GET** `/api/sems/events/[id]/scanner-resources`
[SUPER_ADMIN, ADMIN, SCANNER]
- **POST** `/api/sems/events/[id]/scans`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sems/events/[id]/stats`
[SUPER_ADMIN, ADMIN, SCANNER]
- **GET** `/api/sems/events/scanner`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sems/scanners`

## SIS (Students, Levels, Sections)
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sis/levels`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/sis/levels`
[SUPER_ADMIN, ADMIN]
- **PATCH** `/api/sis/levels`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sis/sections`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/sis/sections`
[SUPER_ADMIN, ADMIN]
- **PATCH** `/api/sis/sections`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sis/students`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/sis/students`
[SUPER_ADMIN, ADMIN]
- **PATCH** `/api/sis/students`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/sis/students/import`
[SUPER_ADMIN, ADMIN]
- **GET** `/api/sis/students/export`

## User Management
[SUPER_ADMIN, ADMIN]
- **GET** `/api/users`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/users`
[SUPER_ADMIN, ADMIN]
- **PATCH** `/api/users/status`
[SUPER_ADMIN, ADMIN]
- **POST** `/api/users/reset-password`
