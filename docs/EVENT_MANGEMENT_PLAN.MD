# Student Event Management System (SEMS) - Execution Plan

This is the detailed execution plan for the Student Event Management System (SEMS). This document bridges the gap between the high-level vision and the actual code we are about to write.

It is divided into three logical zones: **The Dashboard (Admin)**, **The Scanner (Staff)**, and **The Logic Core (The Brain)**.

---

## I. System Architecture & Data Flow

Before building the screens, we must define how data moves. This system uses a **"Local-First, Sync-Later"** architecture.

1.  **Preparation (Online):** Admin sets up Event & Students in Supabase.
2.  **Sync Down (Online $\to$ Offline):** Scanner Staff logs in and clicks "Download Resources." The App fetches the student list (Names + QR Hashes) and saves them to IndexedDB.
3.  **Execution (Offline):** The scanner matches QR codes against IndexedDB. Scans are saved to a local `ScanQueue`.
4.  **Sync Up (Offline $\to$ Online):** Staff clicks "Submit Scans." The App sends the `ScanQueue` to Supabase via a Bulk Insert API.

---

## II. Module Breakdown

### Module A: Admin Dashboard (Web Portal)
**Target User:** Super Admin / Admin  
**Goal:** Configuration and Reporting.

**1. Student Registry & QR Generator**
- **Bulk Upload:** Drag-and-drop CSV area.
- **Required Columns:** ID, First Name, Last Name, Grade, Section.
- **QR Generator:**
  - Grid view of students.
  - **Action:** "Print ID Cards" $\to$ Generates a PDF with 8 IDs per page. Each ID contains the Student Name, Info, and the unique QR Hash.

**2. Event Creator**
- **Basic Details:** Event Title, Date, Venue.
- **Audience Filter:** "Who is this for?" (e.g., Checkbox for Grade 9 and Grade 10).
- **Session Configuration (The Time Logic):**
  - **Input:** Session Name (e.g., "Morning Entry").
  - **Input:** Open Time (07:00 AM).
  - **Input:** Late Threshold (07:30 AM) $\to$ Scans after this are marked "Late".
  - **Input:** Close Time (08:00 AM) $\to$ Scans after this are rejected/marked "Closed".

**3. Live Analytics (The Command Center)**
- **Real-Time Counter:** (Requires Auto-refresh or Realtime subscription) showing Total Scanned vs Expected Attendees.
- **Charts:** Pie chart: Present vs. Absent vs. Late.
- **Export:** "Download Absent List" (PDF) for teachers.

---

## III. The Logic Core (Pseudocode)

### 1. The Scanning Algorithm
```text
Function OnScan(QR_String, Current_Time):
   IF Current_Time < Session.Start_Time:
      Return "Too Early / Event Not Started"
   ELSE IF Current_Time > Session.End_Time:
      Return "Event Closed"
   ELSE IF Student.ID is in Local_Already_Scanned_List:
      Return "Duplicate Scan"
   ELSE IF Current_Time > Session.Start_Time AND Current_Time < Session.Late_Threshold:
      Return Status: "PRESENT"
   ELSE IF Current_Time > Session.Late_Threshold AND Current_Time < Session.End_Time:
      Return Status: "LATE"
```

### 2. Audience Validation Logic
- **Constraint:** A Grade 11 student cannot enter a Grade 10 event.
- **Check:** When scanning, check if `Student.Grade` is inside `Event.Target_Audience` array.
  - **If not:** Return Red Screen: "Restricted: Grade 11 Student".

---

## IV. Implementation Roadmap (Sprint Plan)

We will build this in 4 sequential steps to avoid getting overwhelmed.

**Sprint 1: The Skeleton (Days 1-2)**
- Setup Next.js + Supabase.
- Create Database Tables (Schema provided previously).
- Build the "Login" page and "Dashboard" layout.

**Sprint 2: The Admin Tools (Days 3-4)**
- Build "Add Student" (CSV Import).
- Build "Create Event" form.
- Implement QR Code generation logic (using a library like `qrcode.react`).

**Sprint 3: The Scanner Core (Days 5-7)**
- Implement `react-qr-reader`.
- Set up Dexie.js (IndexedDB).
- Write the logic to download students from Supabase to Dexie.
- Write the logic to save Scans to Dexie.

**Sprint 4: The Sync & Polish (Days 8-9)**
- Build the "Bulk Upload" button.
- Add the Flashlight toggle and Audio feedback.
- Design the "Red/Green" feedback screens with Shadcn UI.

---

## V. UI Wireframe Description

### Screen: Scanner Mode
```plaintext
+---------------------------------------+
|  < Back      Morning Entry      (Flash)| <-- Header
+---------------------------------------+
|                                       |
|             [ CAMERA VIEW ]           |
|                                       |
|           [   Target Box    ]         |
|                                       |
+---------------------------------------+
|                                       |
|  [ Last Scan: John Doe (10-A) ]       | <-- Toast
|                                       |
|      (Sync Pending: 12)  [UPLOAD]     | <-- Footer
+---------------------------------------+
```

### Screen: Admin Analytics
```plaintext
+---------------------------------------+
|  Dashboard > Event: Foundation Day    |
+---------------------------------------+
|  [ Total Attendees: 450 / 500 ]       | <-- Big Metric
+---------------------------------------+
|  [ PIE CHART ]                        |
|  Green: On Time (300)                 |
|  Orange: Late (150)                   |
|  Gray: Absent (50)                    |
+---------------------------------------+
|  Actions:                             |
|  [Download Late List] [End Event]     |
+---------------------------------------+
```

*This plan ensures we meet the offline requirement while keeping the system robust enough for the future "School Management System" expansion.*
