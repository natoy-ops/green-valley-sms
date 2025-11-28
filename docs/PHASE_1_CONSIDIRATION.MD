# Phase 1 Considerations: The "Seed" Strategy

By building the **Student Event Management System (SEMS)** first, you are effectively building the "Engine" of the car before building the rest of the body. If we execute this correctly, the SEMS will not just be a temporary tool; it will become **Phase 1 of your massive School Management System**.

Here is how we architect the "Seed System"—delivering exactly what your sister needs now, while laying the concrete foundation for the full school system later.

---

## 1. The Strategy: "The Trojan Horse" Approach

We will build the core modules required for the Event System, but we will name and structure them as if the full system already exists.

- **Sister’s Request:** "Student Registration"  
  **$\rightarrow$ Our Build:** Core Student Information System (SIS)
- **Sister’s Request:** "Event Creation"  
  **$\rightarrow$ Our Build:** Calendar & Attendance Engine
- **Sister’s Request:** "Scanner & QR"  
  **$\rightarrow$ Our Build:** Universal Identity Module

By doing this, when you eventually add the "Gradebook" or "Tuition Fee" modules in the future, you won't need to migrate data. You just "plug them in" to the existing student records.

---

## 2. Revised Project Scope: Phase 1 (The Event Seed)

**Target Domain:** gvcfissc.org

### Module A: The Universal Core (Student Data)
Instead of just "Event Registration," we build the **Master Student Table**.

**Features:**
- **Bulk Import (CSV/Excel)** for fast onboarding.
- **Data Points:** Student ID (Primary Key), Name, Grade, Section, Guardian Contact (for future SMS alerts), and QR_Hash (Unique Token).
- **Future Proofing:** We will add placeholder columns (nullable) for future data like `Tuition_Balance` or `Medical_Condition` so the table is ready.

### Module B: The Event & Logic Engine
This is the specific logic your sister needs for Morning/Afternoon sessions.

**Event Configuration:**
- **Event Master:** Name, Date, Description.
- **Session Logic (The Complex Part):** Instead of hardcoding "Morning/Afternoon," we will allow dynamic session creation.
  - **Session 1:** Morning In (Start: 7:00, Late: 7:30, End: 8:00)
  - **Session 2:** Morning Out (Start: 11:30, End: 12:30)

### Module C: The Scanner (PWA)
This is the "Offline" component. It is a Progressive Web App (PWA) that runs on the teachers' phones.

**Logic:**
- **Login:** Authenticates once when online.
- **Download:** Fetches the "Allowed List" (Student Hashes) to the phone's local database (IndexedDB).
- **Scan:** Works 100% offline. Checks the QR against the local database.
- **Upload:** When internet returns, pushes the "Attendance Log" back to the server.
