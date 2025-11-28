# Unified School Management System (USMS) - Master Project Plan

**Domain:** gvcfissc.org  
**Architecture:** Next.js (App Router) + Supabase (PostgreSQL) + IndexedDB (Offline-First)

---

## 🚀 Phase 1: The "Seed" & Identity (Immediate Priority)

**Objective:** Establish the digital student database and deliver the Event Management System.

### 1. Student Event Management Module (SEMS)

**Description**  
An offline-capable, QR-based scanning system to track student attendance at school events, assemblies, and gate entries.

**Key Features**
- **Event Logic Engine:**
  - Create events with specific audiences (e.g., "Grade 10 Only").
  - Dynamic Session configuration: Morning In/Out, Afternoon In/Out.
  - Time-window logic: Define "Start Time," "Late Threshold," and "End Time."
- **Offline Scanner (PWA):**
  - **Store-and-Forward:** Downloads valid student hashes to local device (IndexedDB).
  - **Flash/Low-light Mode:** Toggle device torch for evening events.
  - **Status Feedback:** Visual Green/Red screens with audio cues.
  - **Bulk Sync:** Manual "Push to Cloud" button to upload queued scans.
- **Analytics:**
  - Real-time counters (e.g., "450/500 Inside").
  - "Late List" generation for disciplinary action.

### 2. Core Registry & Identity Module (SIS)

**Description**  
The central "Single Source of Truth" database for all users (Staff & Students).

**Key Features**
- **Digital Profile:** Stores Name, Grade, Section, and Guardian Contact (for future SMS alerts).
- **Universal ID:** Generates a unique UUID and QR_HASH for every student upon registration.
- **Bulk Operations:** CSV Import tool to onboard hundreds of students instantly.
- **RBAC (Security):**
  - **Super Admin:** System config & User management.
  - **Admin:** Event creation & Reporting.
  - **Scanner:** Restricted view (Scan screen only).

---

## 🏫 Phase 2: Academic Operations

**Objective:** Manage the daily learning lifecycle.

### 3. Academic Structure & Timetable

**Description**  
Manages the logic of Classes, Sections, and Subjects.

**Key Features**
- **Class Manager:** Define Grade levels and Sections.
- **Subject Allocation:** Assign teachers to subjects.
- **Timetable Generator:** Conflict-free scheduling engine.

### 4. Daily Attendance (Classroom)

**Description**  
Legal record of daily presence (distinct from Event attendance).

**Key Features**
- **Digital Register:** Teachers mark attendance via mobile.
- **Absence Alerts:** Auto-notifications to parents via the Communication Module.
- **Leave Workflow:** Medical leave approval system.

### 5. Examination & Grading

**Description**  
Automated performance tracking and report card generation.

**Key Features**
- **Exam Scheduler:** Hall tickets and seat planning.
- **Gradebook:** Auto-calculation of weighted averages (GPA/Percentage).
- **Report Cards:** One-click PDF generation.

---

## 💰 Phase 3: Business & Administration

**Objective:** Manage revenue and workforce.

### 6. Finance & Fee Management

**Description**  
A complete ledger for school revenue and expense tracking.

**Key Features**
- **Fee Structure:** Dynamic fees (Tuition, Lab, Transport).
- **Invoicing:** Automated monthly/termly invoice generation.
- **Defaulter Logic:** Blocks access to Gradebook if fees are unpaid.

### 7. HR & Payroll

**Description**  
Management of teaching and non-teaching staff.

**Key Features**
- **Staff Database:** Contracts, qualifications, and bios.
- **Payroll Engine:** Salary calculation (Base + Allowances - Deductions).

---

## 🚌 Phase 4: Operations & Logistics

**Objective:** Manage physical assets and safety.

### 8. Transport & Fleet

**Description**  
Management of buses, routes, and student safety.

**Key Features**
- **Route Planning:** Bus stop assignment.
- **GPS Tracking:** Live location view for parents (requires hardware).

### 9. Library Management (LMS)

**Description**  
Tracking of physical books and digital resources.

**Key Features**
- **Cataloging:** ISBN support.
- **Circulation:** Issue/Return workflow with fine calculation.

---

## 📱 Phase 5: The Engagement Layer

**Objective:** Connect Home and School.

### 10. Communication Hub (Parent Portal)

**Description**  
A unified app for parents to view data and communicate with teachers.

**Key Features**
- **Secure Chat:** Internal messaging system.
- **Notice Board:** Digital circulars.
- **Payment Gateway:** Pay school fees online.
