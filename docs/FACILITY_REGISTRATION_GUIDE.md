# Facility Registration Guide

## School Management System

---

<div align="center">

### Official Documentation for Facility Management

**Version 1.0** | **December 2025**

---

</div>

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding Facilities](#understanding-facilities)
3. [Before You Begin: Setting Up Facility Types](#before-you-begin-setting-up-facility-types)
4. [Flow 1: Adding a Single Facility](#flow-1-adding-a-single-facility)
5. [Flow 2: Bulk Import Facilities](#flow-2-bulk-import-facilities)
6. [Flow 3: Managing Facility Availability](#flow-3-managing-facility-availability)
7. [Flow 4: Editing & Updating Facilities](#flow-4-editing--updating-facilities)
8. [Flow 5: Facility Booking for Events](#flow-5-facility-booking-for-events)
9. [Visual Flow Diagrams](#visual-flow-diagrams)
10. [Quick Reference Cards](#quick-reference-cards)
11. [Frequently Asked Questions](#frequently-asked-questions)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Introduction

This guide covers the complete process of registering and managing **facilities** in the School Management System. Facilities include any physical spaces or resources that can be reserved for school activities.

```
┌─────────────────────────────────────────────────────────────────┐
│                     KEY FEATURES                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] Register school facilities                                 │
│      (Classrooms, Labs, Gyms, Auditoriums, etc.)                │
│                                                                  │
│  [2] Organize facilities by type and category                   │
│      (Indoor, Outdoor, Academic, Sports)                        │
│                                                                  │
│  [3] Track facility capacity and equipment                      │
│      (Seating capacity, available resources)                    │
│                                                                  │
│  [4] Manage facility availability and schedules                 │
│      (Operating hours, blocked dates)                           │
│                                                                  │
│  [5] Link facilities to events for venue booking                │
│      (Reserve spaces for school activities)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Understanding Facilities

### What is a Facility?

A **facility** is any physical space or resource in your school that can be used for activities, events, or daily operations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TYPES OF FACILITIES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ACADEMIC SPACES                    SPORTS & RECREATION                     │
│  ─────────────────                  ────────────────────                    │
│  • Classrooms                       • Gymnasium                             │
│  • Computer Labs                    • Basketball Court                      │
│  • Science Laboratories             • Football Field                        │
│  • Library / Reading Room           • Swimming Pool                         │
│  • Audio-Visual Room                • Tennis Court                          │
│                                                                              │
│  MULTI-PURPOSE AREAS                ADMINISTRATIVE SPACES                   │
│  ────────────────────               ───────────────────────                 │
│  • Auditorium / Hall                • Conference Room                       │
│  • Cafeteria / Canteen              • Meeting Room                          │
│  • Covered Court                    • Training Room                         │
│  • Function Room                    • Faculty Lounge                        │
│  • Chapel / Prayer Room             • Counseling Room                       │
│                                                                              │
│  OUTDOOR AREAS                      SPECIALIZED FACILITIES                  │
│  ──────────────────                 ─────────────────────────               │
│  • School Grounds                   • Music Room                            │
│  • Parking Area                     • Art Studio                            │
│  • Garden / Eco Park                • Dance Studio                          │
│  • Outdoor Stage                    • Home Economics Lab                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Facility Information Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FACILITY INFORMATION MODEL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ┌─────────────────────┐                              │
│                        │   FACILITY RECORD   │                              │
│                        │                     │                              │
│                        │  - Facility Name    │                              │
│                        │  - Facility Type    │                              │
│                        │  - Location/Building│                              │
│                        │  - Capacity         │                              │
│                        │  - Description      │                              │
│                        │  - Status           │                              │
│                        └──────────┬──────────┘                              │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                          │
│                    │                             │                          │
│                    ▼                             ▼                          │
│         ┌─────────────────────┐     ┌─────────────────────┐                │
│         │   AVAILABILITY      │     │    EQUIPMENT &      │                │
│         │   SCHEDULE          │     │    RESOURCES        │                │
│         │                     │     │                     │                │
│         │ - Operating Hours   │     │ - Projector         │                │
│         │ - Blocked Dates     │     │ - Sound System      │                │
│         │ - Maintenance Days  │     │ - Air Conditioning  │                │
│         │ - Holiday Closures  │     │ - Chairs/Tables     │                │
│         └─────────────────────┘     └─────────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts to Understand

| Concept | Explanation |
|---------|-------------|
| **Facility Name** | The name used to identify the space (e.g., "Room 101", "Main Gym") |
| **Facility Type** | Category of the facility (e.g., Classroom, Laboratory, Auditorium) |
| **Capacity** | Maximum number of people the facility can accommodate |
| **Location** | Physical location within the school (e.g., Building A, 2nd Floor) |
| **Status** | Current state: Active, Under Maintenance, or Inactive |
| **Availability** | Schedule when the facility can be booked or used |

---

## Before You Begin: Setting Up Facility Types

### Why This Matters

Before adding facilities, you should set up **Facility Types** to organize your spaces. This makes searching and filtering easier.

```
┌─────────────────────────────────────────────────────────────────┐
│                  FACILITY TYPE SETUP                             │
└─────────────────────────────────────────────────────────────────┘

        ┌─────────┐
        │  START  │
        └────┬────┘
             │
             ▼
    ┌────────────────────┐
    │ Step 1: Go to      │
    │ Facility Management│
    │ Module             │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 2: Click      │
    │ "Settings" or      │
    │ "Manage Types"     │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 3: Add        │
    │ Facility Types     │
    │ (e.g., Classroom)  │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 4: Ready to   │
    │ Add Facilities!    │
    └─────────┬──────────┘
              │
              ▼
         ┌────────┐
         │  DONE  │
         └────────┘
```

### Creating Facility Types

#### **Step 1: Navigate to Facility Management**
1. Log in as Administrator
2. Click **"Facilities"** or **"Facility Management"** from the main menu

---

#### **Step 2: Access Facility Type Settings**
1. Look for **"Settings"** or **"Manage Types"**
2. Click to open the type management area

---

#### **Step 3: Add Facility Types**
1. Click **"+ Add Type"**
2. Enter the type name (e.g., "Classroom", "Laboratory")
3. Add a description (optional)
4. Click **"Save"**
5. Repeat for all facility types needed

```
┌─────────────────────────────────────────────────────┐
│             SUGGESTED FACILITY TYPES                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  TYPE NAME              DESCRIPTION                 │
│  ─────────              ───────────                 │
│  Classroom              Regular teaching rooms      │
│  Laboratory             Science/Computer labs       │
│  Auditorium             Large assembly halls        │
│  Gymnasium              Indoor sports facility      │
│  Conference Room        Meeting spaces              │
│  Library                Reading and study area      │
│  Outdoor Field          Open grounds/courts         │
│  Multi-Purpose Hall     Flexible event spaces       │
│  Cafeteria              Dining and food service     │
│  Specialized Room       Music, Art, etc.            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Flow 1: Adding a Single Facility

### When to Use This?
- Adding a new room or space
- Registering a recently built facility
- Setting up a repurposed area

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│                 SINGLE FACILITY REGISTRATION                     │
└─────────────────────────────────────────────────────────────────┘

        ┌─────────┐
        │  START  │
        └────┬────┘
             │
             ▼
    ┌────────────────────┐
    │ Step 1: Go to      │
    │ Facility Management│
    │ Module             │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 2: Click      │
    │ "+ Add Facility"   │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 3: Fill in    │
    │ Facility Details   │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 4: Set        │
    │ Capacity & Status  │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 5: Click      │
    │ "Save Facility"    │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 6: Facility   │
    │ Added to System!   │
    └─────────┬──────────┘
              │
              ▼
         ┌────────┐
         │  DONE  │
         └────────┘
```

### Facility Registration Form

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADD NEW FACILITY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Facility Name *                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Room 101                                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Facility Type *                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Classroom                                           [▼] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Location / Building                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Building A, 1st Floor                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Capacity (Number of People) *                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 40                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Description                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Standard classroom with whiteboard, projector,          │   │
│  │ and air conditioning. Suitable for lectures and         │   │
│  │ small group activities.                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Status                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Active                                              [▼] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  EQUIPMENT & AMENITIES (Check all that apply)                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  [✓] Projector              [✓] Air Conditioning               │
│  [✓] Whiteboard             [ ] Sound System                   │
│  [ ] Computer Stations      [✓] Wi-Fi Access                   │
│  [ ] Stage                  [ ] Video Conferencing             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Save Facility                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                        * Required fields
```

### Field Explanations

| Field | Required? | Description |
|-------|-----------|-------------|
| **Facility Name** | Yes | Unique name for the facility (e.g., "Room 101", "Main Gym") |
| **Facility Type** | Yes | Select from pre-configured types |
| **Location** | No | Physical location description |
| **Capacity** | Yes | Maximum number of occupants |
| **Description** | No | Additional details about the facility |
| **Status** | No | Active (default), Under Maintenance, or Inactive |
| **Equipment** | No | Available amenities and resources |

---

## Flow 2: Bulk Import Facilities

### When to Use This?
- Initial system setup with many facilities
- Adding multiple rooms at once
- Importing from existing records

### Bulk Import Process

```
┌─────────────────────────────────────────────────────────────────┐
│                  BULK IMPORT PROCESS FLOW                        │
└─────────────────────────────────────────────────────────────────┘

        ┌─────────┐
        │  START  │
        └────┬────┘
             │
             ▼
    ┌────────────────────┐
    │ Step 1: Download   │
    │ Import Template    │
    │ (Excel/CSV)        │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 2: Fill in    │
    │ All Facility       │
    │ Information        │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 3: Upload     │
    │ Completed File     │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 4: Review     │
    │ Import Preview     │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 5: Confirm    │
    │ Import             │
    └─────────┬──────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │          SYSTEM AUTOMATICALLY:           │
    │                                          │
    │  ✓ Creates all facility records         │
    │  ✓ Assigns facility types               │
    │  ✓ Sets capacities and locations        │
    │  ✓ Marks all as Active                  │
    └─────────────────────────────────────────┘
              │
              ▼
         ┌────────┐
         │  DONE  │
         └────────┘
```

### Step 1: Download the Import Template

1. Go to **Facility Management**
2. Click **"Import Facilities"** or **"Bulk Import"**
3. Click **"Download Template"**
4. Save the Excel file to your computer

---

### Step 2: Understanding the Template Columns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPORT TEMPLATE COLUMNS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Column A: Facility Name *                                                  │
│            └─ Unique name for the facility (REQUIRED)                       │
│            └─ Example: "Room 101", "Science Lab 1"                          │
│                                                                              │
│  Column B: Facility Type *                                                  │
│            └─ Must match existing type name (REQUIRED)                      │
│            └─ Example: "Classroom", "Laboratory"                            │
│                                                                              │
│  Column C: Location / Building                                              │
│            └─ Physical location description                                 │
│            └─ Example: "Building A, 1st Floor"                              │
│                                                                              │
│  Column D: Capacity *                                                       │
│            └─ Maximum number of people (REQUIRED)                           │
│            └─ Must be a number                                              │
│                                                                              │
│  Column E: Description                                                      │
│            └─ Additional details about the facility                         │
│            └─ Equipment, features, notes                                    │
│                                                                              │
│  Column F: Status                                                           │
│            └─ "Active", "Inactive", or "Maintenance"                        │
│            └─ Defaults to "Active" if left blank                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                * Required fields
```

---

### Step 3: Filling Out the Template

#### Example: Complete Import Data

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SAMPLE IMPORT DATA                                        │
├───────────────┬─────────────┬───────────────────┬──────────┬─────────────────┬────────────┤
│ Facility      │ Type        │ Location          │ Capacity │ Description     │ Status     │
│ Name          │             │                   │          │                 │            │
├───────────────┼─────────────┼───────────────────┼──────────┼─────────────────┼────────────┤
│ Room 101      │ Classroom   │ Building A, 1F    │ 40       │ Standard class  │ Active     │
├───────────────┼─────────────┼───────────────────┼──────────┼─────────────────┼────────────┤
│ Room 102      │ Classroom   │ Building A, 1F    │ 40       │ Standard class  │ Active     │
├───────────────┼─────────────┼───────────────────┼──────────┼─────────────────┼────────────┤
│ Science Lab 1 │ Laboratory  │ Building B, 2F    │ 30       │ Chemistry lab   │ Active     │
├───────────────┼─────────────┼───────────────────┼──────────┼─────────────────┼────────────┤
│ Computer Lab  │ Laboratory  │ Building B, 3F    │ 35       │ 35 PC stations  │ Active     │
├───────────────┼─────────────┼───────────────────┼──────────┼─────────────────┼────────────┤
│ Main Gym      │ Gymnasium   │ Sports Complex    │ 500      │ Indoor sports   │ Active     │
├───────────────┼─────────────┼───────────────────┼──────────┼─────────────────┼────────────┤
│ Auditorium    │ Auditorium  │ Main Building     │ 800      │ Stage, sound    │ Active     │
└───────────────┴─────────────┴───────────────────┴──────────┴─────────────────┴────────────┘
```

#### What This Example Creates:

```
┌─────────────────────────────────────────────────────────────────┐
│                      IMPORT RESULTS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FACILITIES CREATED: 6                                          │
│  ─────────────────────                                          │
│                                                                  │
│  ✓ Room 101 (Classroom - 40 capacity)                          │
│  ✓ Room 102 (Classroom - 40 capacity)                          │
│  ✓ Science Lab 1 (Laboratory - 30 capacity)                    │
│  ✓ Computer Lab (Laboratory - 35 capacity)                     │
│  ✓ Main Gym (Gymnasium - 500 capacity)                         │
│  ✓ Auditorium (Auditorium - 800 capacity)                      │
│                                                                  │
│  TOTAL CAPACITY: 1,445 people                                   │
│                                                                  │
│  BY TYPE:                                                       │
│  ─────────                                                      │
│  • Classrooms: 2                                                │
│  • Laboratories: 2                                              │
│  • Gymnasiums: 1                                                │
│  • Auditoriums: 1                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Step 4: Upload and Import

1. Return to **Facility Management**
2. Click **"Import Facilities"**
3. Click **"Choose File"** or drag-and-drop your Excel file
4. Review the preview for errors (highlighted in red)
5. Click **"Import Facilities"**

```
┌─────────────────────────────────────────────────────────────────┐
│                     IMPORT PREVIEW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  File: facilities_import_2025.xlsx                              │
│  Total Rows: 6                                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Row │ Name          │ Type       │ Status               │   │
│  ├─────┼───────────────┼────────────┼──────────────────────┤   │
│  │  1  │ Room 101      │ Classroom  │ ✓ Ready             │   │
│  │  2  │ Room 102      │ Classroom  │ ✓ Ready             │   │
│  │  3  │ Science Lab 1 │ Laboratory │ ✓ Ready             │   │
│  │  4  │ Computer Lab  │ Laboratory │ ✓ Ready             │   │
│  │  5  │ Main Gym      │ Gymnasium  │ ✓ Ready             │   │
│  │  6  │ Auditorium    │ Auditorium │ ✓ Ready             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│           [Cancel]              [Import Facilities]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 3: Managing Facility Availability

### Setting Up Operating Hours

Each facility can have specific operating hours when it's available for booking.

```
┌─────────────────────────────────────────────────────────────────┐
│                 AVAILABILITY MANAGEMENT                          │
└─────────────────────────────────────────────────────────────────┘

        ┌─────────┐
        │  START  │
        └────┬────┘
             │
             ▼
    ┌────────────────────┐
    │ Step 1: Select     │
    │ a Facility         │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 2: Click      │
    │ "Manage Schedule"  │
    │ or "Availability"  │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 3: Set        │
    │ Operating Hours    │
    │ (Start - End Time) │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 4: Add        │
    │ Blocked Dates      │
    │ (Optional)         │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 5: Click      │
    │ "Save Schedule"    │
    └─────────┬──────────┘
              │
              ▼
         ┌────────┐
         │  DONE  │
         └────────┘
```

### Availability Settings Form

```
┌─────────────────────────────────────────────────────────────────┐
│              FACILITY AVAILABILITY SETTINGS                      │
│              Room 101 - Classroom                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OPERATING HOURS                                                │
│  ────────────────                                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DAY           │ START TIME  │ END TIME    │ AVAILABLE   │   │
│  ├───────────────┼─────────────┼─────────────┼─────────────┤   │
│  │ Monday        │ 07:00 AM    │ 06:00 PM    │ [✓]         │   │
│  │ Tuesday       │ 07:00 AM    │ 06:00 PM    │ [✓]         │   │
│  │ Wednesday     │ 07:00 AM    │ 06:00 PM    │ [✓]         │   │
│  │ Thursday      │ 07:00 AM    │ 06:00 PM    │ [✓]         │   │
│  │ Friday        │ 07:00 AM    │ 06:00 PM    │ [✓]         │   │
│  │ Saturday      │ 08:00 AM    │ 12:00 PM    │ [✓]         │   │
│  │ Sunday        │ ---         │ ---         │ [ ]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  BLOCKED DATES (Facility Not Available)                         │
│  ──────────────────────────────────────                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DATE          │ REASON                      │ ACTIONS   │   │
│  ├───────────────┼─────────────────────────────┼───────────┤   │
│  │ Dec 25, 2025  │ Christmas Holiday           │ [Remove]  │   │
│  │ Jan 1, 2026   │ New Year Holiday            │ [Remove]  │   │
│  │ Jan 15, 2026  │ Scheduled Maintenance       │ [Remove]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [+ Add Blocked Date]                                           │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│           [Cancel]              [Save Schedule]                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Understanding Availability Status

```
┌─────────────────────────────────────────────────────────────────┐
│                  AVAILABILITY STATUS TYPES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │    AVAILABLE     │  The facility can be booked              │
│  │  ░░░░░░░░░░░░░░  │  for events during operating hours       │
│  │    (Green)       │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │     BOOKED       │  The facility is already reserved        │
│  │  ████████████████│  for another event at this time          │
│  │    (Blue)        │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │    BLOCKED       │  The facility is not available           │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  (holiday, maintenance, etc.)            │
│  │    (Gray)        │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │   MAINTENANCE    │  The facility is under repair            │
│  │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│  or renovation                           │
│  │   (Orange)       │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 4: Editing & Updating Facilities

### Viewing All Facilities

1. Go to **Facility Management**
2. View the list of all registered facilities
3. Use filters to narrow down the list

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FACILITIES LIST                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Search: [________________________]    Type: [All Types ▼]                  │
│                                                                              │
│  ┌────────────────┬────────────┬──────────────┬──────────┬────────┬───────┐│
│  │ Facility Name  │ Type       │ Location     │ Capacity │ Status │Actions││
│  ├────────────────┼────────────┼──────────────┼──────────┼────────┼───────┤│
│  │ Room 101       │ Classroom  │ Building A   │ 40       │ Active │ [Edit]││
│  │ Room 102       │ Classroom  │ Building A   │ 40       │ Active │ [Edit]││
│  │ Science Lab 1  │ Laboratory │ Building B   │ 30       │ Active │ [Edit]││
│  │ Main Gym       │ Gymnasium  │ Sports Cmpx  │ 500      │ Active │ [Edit]││
│  │ Auditorium     │ Auditorium │ Main Bldg    │ 800      │ Maint. │ [Edit]││
│  └────────────────┴────────────┴──────────────┴──────────┴────────┴───────┘│
│                                                                              │
│  Showing 5 of 25 facilities                    [◀ Prev] Page 1 [Next ▶]    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Editing a Facility

Click **"Edit"** next to a facility to:
- Update the name or description
- Change the capacity
- Modify the location
- Update equipment/amenities
- Change the status

```
┌─────────────────────────────────────────────────────────────────┐
│                      EDIT FACILITY                               │
│                      Room 101                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Facility Name *                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Room 101 - Smart Classroom                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Capacity (Number of People) *                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 45                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  (Updated from 40 to 45 after adding extra chairs)              │
│                                                                  │
│  Status                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Active                                              [▼] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  STATUS OPTIONS:                                                │
│  ───────────────                                                │
│                                                                  │
│  ( ) Active - Available for booking                             │
│  ( ) Under Maintenance - Temporarily unavailable                │
│  ( ) Inactive - Permanently closed/unused                       │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│           [Cancel]              [Save Changes]                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Changing Facility Status

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATUS CHANGE GUIDE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ACTIVE → UNDER MAINTENANCE                                     │
│  ──────────────────────────────                                 │
│  Use when:                                                      │
│  • Facility needs repairs                                       │
│  • Renovation in progress                                       │
│  • Equipment being replaced                                     │
│                                                                  │
│  Effect: Existing bookings will show a warning                  │
│          New bookings will be blocked                           │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  UNDER MAINTENANCE → ACTIVE                                     │
│  ──────────────────────────────                                 │
│  Use when:                                                      │
│  • Repairs are complete                                         │
│  • Facility is ready for use                                    │
│                                                                  │
│  Effect: Facility becomes available for booking                 │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  ANY STATUS → INACTIVE                                          │
│  ──────────────────────                                         │
│  Use when:                                                      │
│  • Facility is permanently closed                               │
│  • Building demolished or repurposed                            │
│  • No longer part of school facilities                          │
│                                                                  │
│  Effect: Facility hidden from booking options                   │
│          Historical records preserved                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 5: Facility Booking for Events

### How Facilities Connect to Events

When creating school events, you can reserve facilities as venues.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVENT-FACILITY RELATIONSHIP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────┐                                 │
│                         │   SCHOOL EVENT  │                                 │
│                         │                 │                                 │
│                         │  - Event Name   │                                 │
│                         │  - Date & Time  │                                 │
│                         │  - Attendees    │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                           │
│                                  │ SELECT VENUE                             │
│                                  │                                           │
│                                  ▼                                           │
│                    ┌─────────────────────────┐                              │
│                    │      FACILITY           │                              │
│                    │                         │                              │
│                    │  - Room/Space           │                              │
│                    │  - Capacity Check       │                              │
│                    │  - Availability Check   │                              │
│                    └─────────────────────────┘                              │
│                                  │                                           │
│                    ┌─────────────┴─────────────┐                            │
│                    │                           │                            │
│                    ▼                           ▼                            │
│         ┌─────────────────┐         ┌─────────────────┐                    │
│         │   AVAILABLE     │         │   NOT AVAILABLE │                    │
│         │                 │         │                 │                    │
│         │ ✓ Can book      │         │ ✗ Already booked│                    │
│         │ ✓ Confirm event │         │ ✗ Under maint.  │                    │
│         │                 │         │ ✗ Wrong capacity│                    │
│         └─────────────────┘         └─────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Booking Process (During Event Creation)

```
┌─────────────────────────────────────────────────────────────────┐
│                  FACILITY BOOKING FLOW                           │
└─────────────────────────────────────────────────────────────────┘

        ┌─────────┐
        │  START  │
        │ (Event  │
        │ Creation│
        └────┬────┘
             │
             ▼
    ┌────────────────────┐
    │ Step 1: Enter      │
    │ Event Date & Time  │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 2: Enter      │
    │ Expected Attendees │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 3: Click      │
    │ "Select Venue"     │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 4: System     │
    │ Shows Available    │
    │ Facilities         │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 5: Select     │
    │ Your Preferred     │
    │ Facility           │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Step 6: Facility   │
    │ Reserved for Event │
    └─────────┬──────────┘
              │
              ▼
         ┌────────┐
         │  DONE  │
         └────────┘
```

### Venue Selection Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SELECT EVENT VENUE                                    │
│                        Science Fair 2025                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Event Date: December 20, 2025                                              │
│  Event Time: 9:00 AM - 4:00 PM                                              │
│  Expected Attendees: 200                                                    │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│  AVAILABLE FACILITIES (Capacity ≥ 200)                                      │
│  ─────────────────────────────────────                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ( ) Main Gym                                                         │   │
│  │     Type: Gymnasium | Capacity: 500 | Location: Sports Complex       │   │
│  │     Equipment: Sound System, Stage, Projector                        │   │
│  │     Status: ✓ Available                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ( ) Auditorium                                                       │   │
│  │     Type: Auditorium | Capacity: 800 | Location: Main Building       │   │
│  │     Equipment: Full Stage, Professional Sound, Lighting              │   │
│  │     Status: ✓ Available                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │     Covered Court                                                    │   │
│  │     Type: Multi-Purpose | Capacity: 400 | Location: Grounds          │   │
│  │     Status: ✗ Booked (Sports Day)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│           [Cancel]                    [Confirm Venue Selection]            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Flow Diagrams

### Complete Facility Management Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│               COMPLETE FACILITY MANAGEMENT ECOSYSTEM                         │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌─────────────┐                                │
│                              │ADMINISTRATOR│                                │
│                              └──────┬──────┘                                │
│                                     │                                        │
│                    ┌────────────────┼────────────────┐                      │
│                    │                │                │                      │
│                    ▼                ▼                ▼                      │
│           ┌───────────────┐ ┌───────────────┐ ┌───────────────┐            │
│           │ Setup Types   │ │ Add Single    │ │ Bulk Import   │            │
│           │ & Categories  │ │ Facility      │ │ Facilities    │            │
│           └───────┬───────┘ └───────┬───────┘ └───────┬───────┘            │
│                   │                 │                 │                     │
│                   │    ┌────────────┴──────────────┐  │                     │
│                   │    │                           │  │                     │
│                   ▼    ▼                           ▼  ▼                     │
│           ┌───────────────────────────────────────────────────┐            │
│           │               FACILITY RECORDS                     │            │
│           │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │            │
│           │  │ Room    │ │ Lab     │ │ Gym     │ │ Hall    │  │            │
│           │  │ 101     │ │ Science │ │ Main    │ │ Auditor │  │            │
│           │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │            │
│           └───────────────────────────────────────────────────┘            │
│                              │                                              │
│              ┌───────────────┼───────────���───┐                             │
│              │               │               │                             │
│              ▼               ▼               ▼                             │
│    ┌─────────────────┐ ┌───────────┐ ┌─────────────────┐                   │
│    │ Availability    │ │ Equipment │ │ Event Booking   │                   │
│    │ Schedule        │ │ & Details │ │ Integration     │                   │
│    │                 │ │           │ │                 │                   │
│    │ - Hours         │ │ -Projector│ │ - Venue Select  │                   │
│    │ - Blocked Days  │ │ -Sound    │ │ - Capacity Check│                   │
│    │ - Maintenance   │ │ -A/C      │ │ - Reservation   │                   │
│    └─────────────────┘ └───────────┘ └─────────────────┘                   │
│                                             │                               │
│                                             ▼                               │
│                              ┌─────────────────────────┐                   │
│                              │     SCHOOL EVENTS       │                   │
│                              │                         │                   │
│                              │  • Science Fair → Gym   │                   │
│                              │  • Assembly → Auditorium│                   │
│                              │  • Meeting → Room 101   │                   │
│                              └─────────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Facility Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FACILITY LIFECYCLE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│      ┌──────────┐                                                           │
│      │  CREATE  │                                                           │
│      │ Facility │                                                           │
│      └────┬─────┘                                                           │
│           │                                                                  │
│           ▼                                                                  │
│      ┌──────────┐         ┌──────────────┐         ┌──────────────┐        │
│      │  ACTIVE  │ ◄──────►│ UNDER        │ ◄──────►│   ACTIVE     │        │
│      │          │         │ MAINTENANCE  │         │   (Restored) │        │
│      └────┬─────┘         └──────────────┘         └──────────────┘        │
│           │                                                                  │
│           │ Available for                                                   │
│           │ Event Booking                                                   │
│           │                                                                  │
│           ▼                                                                  │
│      ┌──────────────────────────────────────┐                               │
│      │           DAILY OPERATIONS            │                               │
│      │                                       │                               │
│      │   ┌─────────┐    ┌─────────┐         │                               │
│      │   │Available│ ←→ │ Booked  │         │                               │
│      │   └─────────┘    └─────────┘         │                               │
│      │                                       │                               │
│      └──────────────────────────────────────┘                               │
│           │                                                                  │
│           │ Permanent Closure                                               │
│           │                                                                  │
│           ▼                                                                  │
│      ┌──────────┐                                                           │
│      │ INACTIVE │                                                           │
│      │ (Closed) │                                                           │
│      └──────────┘                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Cards

### For Administrators: Facility Management

```
┌─────────────────────────────────────────────────────────────────┐
│         ADMIN QUICK REFERENCE: FACILITY MANAGEMENT               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INITIAL SETUP:                                                 │
│  ──────────────                                                 │
│  Facilities → Settings → Create Facility Types                  │
│  (Classroom, Laboratory, Gymnasium, etc.)                       │
│                                                                  │
│  ADD SINGLE FACILITY:                                           │
│  ────────────────────                                           │
│  Facilities → + Add Facility → Fill Form → Save                 │
│                                                                  │
│  BULK IMPORT:                                                   │
│  ────────────                                                   │
│  Facilities → Import → Download Template → Fill Excel →         │
│  Upload → Review → Import                                       │
│                                                                  │
│  SET AVAILABILITY:                                              │
│  ─────────────────                                              │
│  Select Facility → Manage Schedule → Set Hours →                │
│  Add Blocked Dates → Save                                       │
│                                                                  │
│  EDIT FACILITY:                                                 │
│  ──────────────                                                 │
│  Select Facility → Edit → Update Details → Save                 │
│                                                                  │
│  CHANGE STATUS:                                                 │
│  ──────────────                                                 │
│  Select Facility → Edit → Change Status →                       │
│  (Active / Maintenance / Inactive) → Save                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### For Event Organizers: Booking Facilities

```
┌─────────────────────────────────────────────────────────────────┐
│        EVENT ORGANIZER QUICK REFERENCE: VENUE BOOKING            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WHEN CREATING AN EVENT:                                        │
│  ───────────────────────                                        │
│                                                                  │
│  1. Enter event date and time                                   │
│  2. Enter expected number of attendees                          │
│  3. Click "Select Venue" or "Choose Facility"                   │
│  4. Review available facilities                                 │
│     (System filters by capacity and availability)               │
│  5. Select your preferred facility                              │
│  6. Confirm selection                                           │
│                                                                  │
│  CHECKING AVAILABILITY:                                         │
│  ──────────────────────                                         │
│                                                                  │
│  ✓ Green = Available (can book)                                │
│  ✗ Red/Gray = Not Available (booked or blocked)                │
│  ⚠ Orange = Under Maintenance                                   │
│                                                                  │
│  CAPACITY GUIDELINES:                                           │
│  ────────────────────                                           │
│                                                                  │
│  Always select a facility with capacity ≥ attendees             │
│  Consider equipment needs (projector, sound, etc.)              │
│  Check location convenience for your event type                 │
│                                                                  │
│  NEED A DIFFERENT FACILITY?                                     │
│  ─────────────────────────                                      │
│                                                                  │
│  Contact your administrator to:                                 │
│  • Request maintenance completion                               │
│  • Ask about alternative facilities                             │
│  • Check for schedule conflicts                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Facility Capacity Guidelines

```
┌─────────────────────────────────────────────────────────────────┐
│              FACILITY CAPACITY QUICK GUIDE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EVENT TYPE          SUGGESTED FACILITY         MIN CAPACITY    │
│  ──────────          ──────────────────         ────────────    │
│                                                                  │
│  Class/Lecture       Classroom                  30-50           │
│  Lab Activity        Laboratory                 20-35           │
│  Small Meeting       Conference Room            10-20           │
│  Department Mtg      Multi-Purpose Room         50-100          │
│  Assembly            Auditorium/Gym             200-500         │
│  School Program      Auditorium                 500+            │
│  Sports Event        Gymnasium/Field            100-500         │
│  Parent Conference   Classroom/Hall             30-100          │
│  Training/Workshop   Training Room              20-40           │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  CAPACITY CALCULATION TIP:                                      │
│  ─────────────────────────                                      │
│                                                                  │
│  For comfortable seating, add 20% buffer                        │
│  Example: 100 expected → select facility with 120+ capacity    │
│                                                                  │
│  For standing events, you can use higher density                │
│  Example: 100-capacity room → can hold ~150 standing           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frequently Asked Questions

### General Questions

```
┌─────────────────────────────────────────────────────────────────┐
│                    FREQUENTLY ASKED QUESTIONS                    │
└─────────────────────────────────────────────────────────────────┘

Q: Can the same facility be used for multiple events on the same day?
───────────────────────────────────────────────────────────────────
A: YES, as long as the time slots don't overlap. The system
   checks for conflicts automatically.

Q: What happens if I need to change a facility's capacity?
──────────────────────────────────────────────────────────
A: Edit the facility and update the capacity. Existing bookings
   remain unchanged, but new bookings will use the updated value.

Q: Can I temporarily close a facility?
─────────────────────────────────────
A: YES. Change the status to "Under Maintenance". This prevents
   new bookings while preserving existing ones.

Q: What if two events want the same facility at the same time?
─────────────────────────────────────────────────────────────
A: First-come, first-served. Once booked, the time slot becomes
   unavailable. The second event must choose another facility
   or time.

Q: Can I add a new facility type?
───────────────────────────────────
A: YES. Go to Facility Settings → Add Type → Enter name and
   description → Save. New type will be available immediately.

Q: How do I know which facilities have projectors?
──────────────────────────────────────────────────
A: Check the equipment/amenities section when viewing facility
   details. You can also filter by equipment if available.

Q: Can I delete a facility?
───────────────────────────
A: It's recommended to mark as "Inactive" instead of deleting.
   This preserves historical booking records. Contact system
   admin for permanent deletion if needed.

Q: How far in advance can facilities be booked?
──────────────────────────────────────────────
A: This depends on your school's policy settings. Typically,
   facilities can be booked 30-90 days in advance.
```

---

## Troubleshooting Guide

### Common Issues and Solutions

```
┌─────────────────────────────────────────────────────────────────┐
│                    TROUBLESHOOTING GUIDE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PROBLEM: "Facility type not found" during import               │
│  ─────────────────────────────────────────────────              │
│  CAUSE: The type name in Excel doesn't match system types       │
│  FIX: Check exact spelling. Use the same name as configured     │
│       in Facility Settings (case-sensitive)                     │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  PROBLEM: "Duplicate facility name"                             │
│  ──────────────────────────────────                             │
│  CAUSE: A facility with the same name already exists            │
│  FIX: Use a unique name. Add location or number                 │
│       (e.g., "Room 101 - Building A")                          │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  PROBLEM: "Invalid capacity value"                              │
│  ─────────────────────────────────                              │
│  CAUSE: Capacity must be a positive number                      │
│  FIX: Enter numbers only (e.g., "40" not "40 people")          │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  PROBLEM: Facility not showing in venue selection               │
│  ────────────────────────────────────────────────               │
│  CAUSE: Could be multiple reasons                               │
│  CHECK:                                                         │
│  • Is the facility status "Active"?                             │
│  • Is the date/time within operating hours?                     │
│  • Is the date blocked or already booked?                       │
│  • Is the capacity sufficient for your event?                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  PROBLEM: Cannot edit facility details                          │
│  ────────────────────────────────────                           │
│  CAUSE: Insufficient permissions                                │
│  FIX: Contact administrator for edit access                     │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  PROBLEM: Facility shows "Booked" but no event visible          │
│  ──────────────────────────────────────────────────────         │
│  CAUSE: Event may be from another department or private         │
│  FIX: Contact administrator to check booking details            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Maintenance Status Issues

```
┌─────────────────────────────────────────────────────────────────┐
│                 MAINTENANCE STATUS ISSUES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PROBLEM: Facility stuck in "Under Maintenance"                 │
│  ──────────────────────────────────────────────                 │
│  STEPS:                                                         │
│  1. Go to Facilities → Select the facility                      │
│  2. Click "Edit"                                                │
│  3. Change Status from "Under Maintenance" to "Active"          │
│  4. Save Changes                                                │
│                                                                  │
│  ─────────────────────────────────────────────────────────     │
│                                                                  │
│  PROBLEM: Need to notify users about maintenance                │
│  ─────────────────────────────────────────────────              │
│  STEPS:                                                         │
│  1. Check for existing bookings in the facility                 │
│  2. Contact event organizers to reschedule                      │
│  3. Then change status to "Under Maintenance"                   │
│  4. Add blocked dates for the maintenance period                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Import Template Reference

### Complete Import Template Structure

| Column | Header Name | Required | Description | Example |
|--------|-------------|----------|-------------|---------|
| A | Facility Name | **Yes** | Unique name for the facility | Room 101 |
| B | Facility Type | **Yes** | Must match existing type | Classroom |
| C | Location | No | Physical location | Building A, 1F |
| D | Capacity | **Yes** | Maximum occupancy (number) | 40 |
| E | Description | No | Additional details | Standard classroom |
| F | Status | No | Active, Maintenance, Inactive | Active |

### Sample Template Data

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        SAMPLE TEMPLATE DATA                                 │
├───────────────┬─────────────┬──────────────┬──────────┬──────────┬────────┤
│ Facility Name │ Type        │ Location     │ Capacity │ Descript.│ Status │
├───────────────┼─────────────┼──────────────┼──────────┼──────────┼────────┤
│ Room 101      │ Classroom   │ Bldg A, 1F   │ 40       │ Standard │ Active │
│ Room 102      │ Classroom   │ Bldg A, 1F   │ 40       │ Standard │ Active │
│ Room 103      │ Classroom   │ Bldg A, 1F   │ 35       │ Smaller  │ Active │
│ Science Lab 1 │ Laboratory  │ Bldg B, 2F   │ 30       │ Chemistry│ Active │
│ Science Lab 2 │ Laboratory  │ Bldg B, 2F   │ 30       │ Physics  │ Active │
│ Computer Lab  │ Laboratory  │ Bldg B, 3F   │ 35       │ 35 PCs   │ Active │
│ Library       │ Library     │ Main Bldg    │ 100      │ Reading  │ Active │
│ Main Gym      │ Gymnasium   │ Sports Cmpx  │ 500      │ Indoor   │ Active │
│ Auditorium    │ Auditorium  │ Main Bldg    │ 800      │ Events   │ Active │
│ Conference Rm │ Conference  │ Admin Bldg   │ 20       │ Meetings │ Active │
└───────────────┴─────────────┴──────────────┴──────────┴──────────┴────────┘
```

---

<div align="center">

---

**Document Prepared For:** User Guidance & Training

**System:** School Management System - Facility Management Module

**Version:** 1.0 | **Date:** December 2025

---

*This document is intended for internal use and training purposes.*

</div>
