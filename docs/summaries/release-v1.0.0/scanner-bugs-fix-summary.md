# Scanner Bugs Fix Summary

**Date**: November 27, 2025  
**Scope**: SEMS Offline Scanner functionality

---

## Issues Fixed

### 1. "Scanner resources missing" Error
**File**: `src/app/(dashboard)/sems/scan/[eventId]/page.tsx`

**Problem**: Error appeared despite data being downloaded. A misplaced camera check in `loadResources()` caused early return without loading event data from IndexedDB.

**Fix**: Removed the misplaced camera check from `loadResources()`. Resource loading is now independent of camera support.

---

### 2. Incorrect Student Count (10 instead of 6)
**File**: `src/app/api/sems/events/[id]/scanner-resources/route.ts`

**Problem**: API returned ALL active students instead of filtering by the event's `audienceConfig`. When a user had access to multiple events (e.g., 6 + 4 = 10 students total), all students were returned for each event.

**Fix**: Added `filterStudentsByAudienceConfig()` function that:
- Processes `include` rules (ALL_STUDENTS, LEVEL, SECTION, STUDENT)
- Then processes `exclude` rules to remove matches
- Returns only students matching the event's audience configuration

---

### 3. Stale Closure in processScan
**File**: `src/app/(dashboard)/sems/scan/[eventId]/page.tsx`

**Problem**: `processScan` used `eventRecord` React state, but due to async state updates, the function could run before state was updated (stale closure), causing "Scanner resources are not available" error even with downloaded data.

**Fix**: Added fallback to query IndexedDB directly:
```tsx
const currentEventRecord = eventRecord ?? (await scannerDb.scannerEvents.get(eventId));
```

---

### 4. Camera Not Opening on Event Click
**File**: `src/app/(dashboard)/sems/scan/[eventId]/page.tsx`

**Problem**: Camera only started if URL had `?autostart=1` param.

**Fix**: Changed useEffect to always start camera on mount:
```tsx
useEffect(() => {
  const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  setIsCameraSupported(hasMedia);
  if (hasMedia) {
    void startScanning();
  }
  return () => { void stopScanning(); };
}, []);
```

---

## Files Modified
- `src/app/(dashboard)/sems/scan/[eventId]/page.tsx`
- `src/app/api/sems/events/[id]/scanner-resources/route.ts`

## Testing Notes
After applying fixes:
1. Clear browser IndexedDB (`semsScanner` database)
2. Re-download scanner data for each event
3. Verify correct student counts per event
4. Verify camera opens automatically on event selection
5. Verify scanning works without "resources missing" error
