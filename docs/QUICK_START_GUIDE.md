# School Management System - Quick Start Guide

**Version 1.0** | **December 2025**

---

## Table of Contents

1. [User Accounts](#1-user-accounts)
2. [Students & Parents](#2-students--parents)
3. [Facilities](#3-facilities)
4. [Events](#4-events)
5. [Event Day Scanning](#5-event-day-scanning)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. User Accounts

### Creating a Single User (Admin, Teacher, Staff)

1. Go to **Users** menu
2. Click **+ Add User**
3. Fill in: Name, Email, Role
4. Click **Create User**
5. **Copy the temporary password** (shown only once!)
6. Share credentials with the user securely

### Bulk Import Users

1. Go to **Users** → **Import Users**
2. Click **Download Template**
3. Fill Excel with: Name, Email (one per row)
4. Upload the file
5. Select the Role for all users
6. Click **Import**
7. **Download Credentials file** immediately

### First-Time Login (For New Users)

1. Go to the system URL
2. Enter your email + temporary password
3. Click **Sign In**
4. Go to **Profile** → **Security** → Change your password

---

## 2. Students & Parents

### Before Adding Students

**Set up Grade Levels & Sections first:**

1. Go to **Student Information System (SIS)**
2. Create Grade Levels (Grade 7, Grade 8, etc.)
3. Create Sections for each grade (Section A, B, C, etc.)

### Adding a Single Student

1. Go to **SIS** → **+ Add Student**
2. Fill in: Name, Grade Level, Section
3. Click **Save**
4. QR code is generated automatically

> **Note:** Single add does NOT create parent accounts.

### Bulk Import Students + Parents (Recommended)

1. Go to **SIS** → **Bulk Import**
2. Click **Download Template**
3. Fill Excel columns:

| Column | What to Enter |
|--------|---------------|
| ID/LRN | Student ID (optional - auto-generates if blank) |
| First Name | Student's first name |
| Last Name | Student's last name |
| Grade/Level | Must match exactly (e.g., "Grade 10") |
| Section | Must match exactly (e.g., "Section A") |
| Student Email | Creates student login if provided |
| Guardian Email | Creates parent login if provided |

4. Upload file → Review → Click **Import**
5. **Download BOTH credential files** (Student + Parent)

### Siblings (Same Parent, Multiple Children)

Use the **same Guardian Email** for siblings → System automatically links them to one parent account.

### Export QR Codes

1. Go to **SIS** → Filter by Grade/Section
2. Click **Export QR Codes**
3. Choose: Excel (records) or Word (print ID cards)

---

## 3. Facilities

### Adding a Single Facility

1. Go to **Facilities** → **+ Add Facility**
2. Fill in:
   - Facility Name (e.g., "Room 101")
   - Type (Classroom, Laboratory, Auditorium, etc.)
   - Capacity (number of people)
   - Location (optional)
3. Click **Save**

### Bulk Import Facilities

1. Go to **Facilities** → **Import**
2. Download template
3. Fill Excel: Name, Type, Location, Capacity
4. Upload → Review → Import

### Set Facility Availability

1. Select a facility → **Manage Schedule**
2. Set operating hours per day
3. Add blocked dates (holidays, maintenance)
4. Save

### Facility Status

| Status | Meaning |
|--------|---------|
| **Active** | Available for booking |
| **Under Maintenance** | Temporarily unavailable |
| **Inactive** | Permanently closed |

---

## 4. Events

### Creating an Event

1. Go to **Events** → **+ Create Event**
2. Fill in:
   - Event Name
   - Event Type (Meeting, Program, Activity)
   - Date & Time (Start and End)
   - Venue (select from available facilities)
3. Click **Save as Draft** or **Publish**

### Adding Participants

1. Open Event → **Participants** tab
2. Select by:
   - Grade Level / Section (select grades to invite)
   - Individual Selection (search specific students)
3. Click **Save Participants**

### Setting Up Attendance Tracking

1. Open Event → **Attendance** tab
2. Enable attendance tracking
3. Choose method: QR Code, Manual, or Both
4. Set check-in window (e.g., 30 min before to 1 hour after start)
5. Save

### Publishing the Event

1. Open Event → Click **Publish**
2. Event becomes visible to participants
3. RSVP collection begins

### Event Status Flow

```
Draft → Published → Ongoing → Completed
                 ↘ Canceled
```

### Managing RSVP

1. Open Event → **RSVP** tab
2. View responses: Attending, Not Attending, Maybe, No Response
3. Click **Send Reminder** for non-responders

---

## 5. Event Day Scanning

### Setting Up the Scanner

1. Open browser on your device (phone/tablet/laptop)
2. Go to the system URL → Log in
3. Go to **Events** → Select today's event
4. Click **Start Scanning**
5. Allow camera access when prompted

### Scanning Students

1. Ask student to show QR code
2. Point camera at QR code (6-12 inches away)
3. Wait for confirmation (beep/visual)
4. Check result:

| Result | Color | Meaning | Action |
|--------|-------|---------|--------|
| Success | Green | Checked in | Proceed |
| Late | Yellow | Arrived late | Proceed |
| Already In | Orange | Duplicate scan | None needed |
| Not Invited | Red | Not on list | Add or deny |
| Invalid QR | Red | Can't read code | Manual check-in |

### Manual Check-in (Backup)

1. Click **Manual Check-in**
2. Search student by name
3. Select the correct student
4. Click **Mark Present**

### Closing the Event

1. Stop scanning
2. Click **End Event** or **Close Attendance**
3. Review final summary
4. Export reports if needed

---

## 6. Troubleshooting

### Login Issues

| Problem | Solution |
|---------|----------|
| Invalid credentials | Check email spelling, copy-paste password |
| Account inactive | Contact administrator |
| Forgot password | Contact admin for reset |

### Import Issues

| Error | Solution |
|-------|----------|
| "Level not found" | Check grade name spelling (must match exactly) |
| "Section not found" | Create the section first, or leave blank |
| "Duplicate ID" | Use different ID or leave blank |
| "Email exists" | Use different email or leave blank |

### Scanner Issues

| Problem | Solution |
|---------|----------|
| Camera black screen | Refresh page, re-allow camera |
| Scanner slow | Check internet, close other apps |
| QR won't scan | Better lighting, clean lens, hold steady |
| No internet | Use mobile data or paper backup |

### Event Issues

| Problem | Solution |
|---------|----------|
| Facility not available | Choose different time/date/venue |
| Can't add participants | Create grade levels/sections first |
| RSVP not showing | Make sure event is Published |

---

## Quick Reference

### Admin Tasks

| Task | Path |
|------|------|
| Add User | Users → + Add User |
| Import Users | Users → Import → Upload Excel |
| Reset Password | Users → Find User → ⋮ → Reset Password |
| Add Student | SIS → + Add Student |
| Import Students | SIS → Bulk Import |
| Export QR Codes | SIS → Export QR Codes |
| Add Facility | Facilities → + Add Facility |
| Create Event | Events → + Create Event |

### User Roles

| Role | Access |
|------|--------|
| Super Admin | Full system access |
| Admin | User & data management |
| Teacher | Class & student management |
| Staff | Limited administrative access |
| Student | View own records & events |
| Parent | View children's records & RSVP |
| Scanner | Event attendance scanning only |

---

## Password Requirements

- Minimum 12 characters
- At least one UPPERCASE letter
- At least one lowercase letter
- At least one number

**Example:** `MySchool2025Pass`

---

## Need Help?

Contact your school administrator for:
- Password resets
- Account issues
- Missing access permissions
- System questions

---

*This guide covers the essential processes. For detailed documentation, refer to the individual module guides.*
