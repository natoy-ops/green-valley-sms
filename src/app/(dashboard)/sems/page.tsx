"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Calendar as CalendarIcon, ShieldAlert, X, QrCode, Users, ChevronDown, ChevronRight, Search, Minus, UserX, Check, Megaphone, AlertTriangle, Building2, MapPin, Trash2 } from "lucide-react";
import { VenueCard, type VenueAvailabilityStatus, type SessionConflict } from "@/components/venue-card";
import { EventAttendanceInsights } from "@/components/event-attendance-insights";
import { useRouter } from "next/navigation";
import { format, eachDayOfInterval, isSameDay, isBefore, startOfToday } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ============================================================================
// Audience Configuration Types
// ============================================================================

type AudienceRuleKind = "ALL_STUDENTS" | "LEVEL" | "SECTION" | "STUDENT";
type AudienceRuleEffect = "include" | "exclude";

interface AudienceRuleBase {
  kind: AudienceRuleKind;
  effect: AudienceRuleEffect;
}

interface AllStudentsRule extends AudienceRuleBase {
  kind: "ALL_STUDENTS";
}

interface LevelRule extends AudienceRuleBase {
  kind: "LEVEL";
  levelIds: string[];
}

interface SectionRule extends AudienceRuleBase {
  kind: "SECTION";
  sectionIds: string[];
}

interface StudentRule extends AudienceRuleBase {
  kind: "STUDENT";
  studentIds: string[];
}

type AudienceRule = AllStudentsRule | LevelRule | SectionRule | StudentRule;

interface EventAudienceConfig {
  version: 1;
  rules: AudienceRule[];
}

type AudienceMode = "all" | "level_section" | "students" | "mixed";

// ============================================================================
// Data Types
// ============================================================================

interface LevelDto {
  id: string;
  name: string;
  isActive: boolean;
}

interface SectionDto {
  id: string;
  name: string;
  levelId: string | null;
  isActive: boolean;
}

interface StudentDto {
  id: string;
  name: string;
  grade: string;
  section: string;
  lrn: string;
  status: "Active" | "Inactive";
}

interface ScannerUser {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
}

/**
 * Event list item from API for display in the events table.
 */
interface EventListItem {
  id: string;
  title: string;
  timeRange: string;
  venue: string | null;
  audienceSummary: string;
   scannerSummary: string;
  actualAttendees: number;
  expectedAttendees: number;
  status: "live" | "scheduled" | "completed";
  startDate: string;
  endDate: string;
  lifecycleStatus: string;
}

/**
 * Full event data for editing, returned from GET /api/sems/events/:id
 */
interface EventEditData {
  id: string;
  title: string;
  description: string | null;
  posterImageUrl: string | null;
  startDate: string;
  endDate: string;
  facility: {
    id: string;
    name: string;
    location: string;
  } | null;
  audienceConfig: EventAudienceConfig;
  sessionConfig: {
    version: 2;
    dates: Array<{
      date: string;
      sessions: Array<{
        id: string;
        name: string;
        period: SessionPeriod;
        direction: SessionDirection;
        opens: string;
        lateAfter: string | null;
        closes: string;
      }>;
    }>;
  };
  scannerConfig: {
    version: 1;
    scannerIds: string[];
  };
}

const EVENTS_DATA = {
  overview: [
    {
      label: "Today's Events",
      value: "3",
      description: "Events scheduled today",
    },
    {
      label: "Live Check-ins",
      value: "450 / 500",
      description: "Across all live events",
    },
    {
      label: "Late Arrivals",
      value: "57",
      description: "Marked \"Late\" today",
    },
    {
      label: "Sync Status",
      value: "Sync pending: 12",
      description: "Waiting to upload to Supabase",
    },
  ],
  todaysEvents: [
    {
      id: 1,
      name: "Morning Assembly",
      time: "07:00 - 08:00 AM",
      venue: "Main Grounds",
      audience: "Grades 7-10",
      status: "Live" as const,
      attendees: "450 / 500",
    },
    {
      id: 2,
      name: "Grade 10 Science Fair",
      time: "09:00 - 11:00 AM",
      venue: "Science Wing",
      audience: "Grade 10",
      status: "Scheduled" as const,
      attendees: "120 / 150",
    },
    {
      id: 3,
      name: "Staff Meeting",
      time: "02:00 - 03:00 PM",
      venue: "AV Room",
      audience: "Faculty",
      status: "Completed" as const,
      attendees: "45 / 50",
    },
  ],
};

interface Facility {
  id: string;
  name: string;
  type: string;
  location: string;
  imageUrl: string | null;
  capacity: number | null;
  status: "operational" | "maintenance" | "out_of_service" | "retired";
}

/**
 * Venue availability result from the API.
 */
interface VenueAvailabilityResult {
  facilityId: string;
  facilityName: string;
  facilityLocation: string;
  facilityImageUrl: string | null;
  facilityCapacity: number | null;
  status: VenueAvailabilityStatus;
  conflicts: SessionConflict[];
  availabilityMap: Record<string, boolean>;
}

type SessionPeriod = "morning" | "afternoon" | "evening";

type SessionDirection = "in" | "out";

interface AttendanceSessionConfig {
  id: string;
  period: SessionPeriod;
  direction: SessionDirection;
  name: string;
  supportsLateAfter: boolean;
  opens: string;
  lateAfter: string;
  closes: string;
}

const DEFAULT_SESSION_CONFIGS: AttendanceSessionConfig[] = [
  {
    id: "morning-in",
    period: "morning",
    direction: "in",
    name: "Morning In",
    supportsLateAfter: true,
    opens: "",
    lateAfter: "",
    closes: "",
  },
  {
    id: "morning-out",
    period: "morning",
    direction: "out",
    name: "Morning Out",
    supportsLateAfter: false,
    opens: "",
    lateAfter: "",
    closes: "",
  },
  {
    id: "afternoon-in",
    period: "afternoon",
    direction: "in",
    name: "Afternoon In",
    supportsLateAfter: true,
    opens: "",
    lateAfter: "",
    closes: "",
  },
  {
    id: "afternoon-out",
    period: "afternoon",
    direction: "out",
    name: "Afternoon Out",
    supportsLateAfter: false,
    opens: "",
    lateAfter: "",
    closes: "",
  },
  {
    id: "evening-in",
    period: "evening",
    direction: "in",
    name: "Evening In",
    supportsLateAfter: true,
    opens: "",
    lateAfter: "",
    closes: "",
  },
  {
    id: "evening-out",
    period: "evening",
    direction: "out",
    name: "Evening Out",
    supportsLateAfter: false,
    opens: "",
    lateAfter: "",
    closes: "",
  },
];

// Per-date session configuration
interface DateSessionConfig {
  date: string; // ISO date string YYYY-MM-DD
  enabledPeriods: Set<SessionPeriod>;
  sessions: AttendanceSessionConfig[];
}

function createDefaultDateConfig(dateStr: string): DateSessionConfig {
  return {
    date: dateStr,
    enabledPeriods: new Set<SessionPeriod>(["morning", "afternoon"]),
    sessions: DEFAULT_SESSION_CONFIGS.map((s) => ({ ...s })),
  };
}

function haveUniformSessionSchedule(
  dates: EventEditData["sessionConfig"]["dates"] | undefined
): boolean {
  if (!dates || dates.length <= 1) {
    return true;
  }

  const normalizeSessions = (
    sessions: EventEditData["sessionConfig"]["dates"][number]["sessions"]
  ) =>
    [...sessions]
      .map((session) => ({
        id: session.id,
        period: session.period,
        direction: session.direction,
        opens: session.opens,
        lateAfter: session.lateAfter ?? null,
        closes: session.closes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

  const [first, ...rest] = dates;
  const firstNormalized = normalizeSessions(first.sessions);

  return rest.every((date) => {
    const current = normalizeSessions(date.sessions);
    if (current.length !== firstNormalized.length) {
      return false;
    }

    return current.every((session, index) => {
      const baseline = firstNormalized[index];
      return (
        session.id === baseline.id &&
        session.period === baseline.period &&
        session.direction === baseline.direction &&
        session.opens === baseline.opens &&
        (session.lateAfter ?? null) === (baseline.lateAfter ?? null) &&
        session.closes === baseline.closes
      );
    });
  });
}

function shouldRedirectToLogin(response: Response): boolean {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return true;
  }
  return false;
}

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  published: "Published",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatLifecycleStatus(status: string | null | undefined): string {
  if (!status) return "";
  const normalized = status.toLowerCase();
  if (LIFECYCLE_LABELS[normalized]) {
    return LIFECYCLE_LABELS[normalized];
  }
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLifecycleBadgeClasses(status: string | null | undefined): string {
  const normalized = (status ?? "").toLowerCase();

  switch (normalized) {
    case "draft":
      return "bg-muted text-muted-foreground border-border/70";
    case "pending_approval":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/40";
    case "approved":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/40";
    case "published":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-200 border-sky-500/40";
    case "completed":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-500/40";
    case "cancelled":
      return "bg-red-500/10 text-red-700 dark:text-red-200 border-red-500/40";
    default:
      return "bg-muted text-muted-foreground border-border/70";
  }
}

// ============================================================================
// Session Time Conflict Detection
// ============================================================================

interface SessionTimeWarning {
  sessionId: string;
  field: "opens" | "lateAfter" | "closes";
  message: string;
  severity: "error" | "warning";
}

/**
 * Parse a time string (HH:mm) to minutes since midnight for comparison.
 * Returns null if the time is empty or invalid.
 */
function parseTimeToMinutes(time: string): number | null {
  if (!time || !time.includes(":")) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Detect time conflicts within and between sessions.
 * Returns an array of warnings to display.
 */
function detectSessionTimeConflicts(
  sessions: AttendanceSessionConfig[],
  enabledPeriods: Set<SessionPeriod>
): SessionTimeWarning[] {
  const warnings: SessionTimeWarning[] = [];
  
  // Filter to only enabled sessions and sort by expected order
  const periodOrder: SessionPeriod[] = ["morning", "afternoon", "evening"];
  const directionOrder: SessionDirection[] = ["in", "out"];
  
  const enabledSessions = sessions
    .filter((s) => enabledPeriods.has(s.period))
    .sort((a, b) => {
      const periodDiff = periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period);
      if (periodDiff !== 0) return periodDiff;
      return directionOrder.indexOf(a.direction) - directionOrder.indexOf(b.direction);
    });

  // Check each session for internal conflicts
  for (const session of enabledSessions) {
    const opens = parseTimeToMinutes(session.opens);
    const closes = parseTimeToMinutes(session.closes);
    const lateAfter = parseTimeToMinutes(session.lateAfter);

    // Check: opens should be before closes
    if (opens !== null && closes !== null && opens >= closes) {
      warnings.push({
        sessionId: session.id,
        field: "closes",
        message: `"Closes" (${session.closes}) must be after "Opens" (${session.opens})`,
        severity: "error",
      });
    }

    // Check: lateAfter should be between opens and closes (for entry sessions)
    if (session.supportsLateAfter && lateAfter !== null) {
      if (opens !== null && lateAfter < opens) {
        warnings.push({
          sessionId: session.id,
          field: "lateAfter",
          message: `"Late After" (${session.lateAfter}) should not be before "Opens" (${session.opens})`,
          severity: "warning",
        });
      }
      if (closes !== null && lateAfter > closes) {
        warnings.push({
          sessionId: session.id,
          field: "lateAfter",
          message: `"Late After" (${session.lateAfter}) should not be after "Closes" (${session.closes})`,
          severity: "warning",
        });
      }
    }
  }

  // Check for overlaps between consecutive sessions
  for (let i = 0; i < enabledSessions.length - 1; i++) {
    const current = enabledSessions[i];
    const next = enabledSessions[i + 1];
    
    const currentCloses = parseTimeToMinutes(current.closes);
    const nextOpens = parseTimeToMinutes(next.opens);

    if (currentCloses !== null && nextOpens !== null && currentCloses > nextOpens) {
      warnings.push({
        sessionId: current.id,
        field: "closes",
        message: `"${current.name}" closes at ${current.closes}, but "${next.name}" opens at ${next.opens}. Sessions overlap.`,
        severity: "error",
      });
      warnings.push({
        sessionId: next.id,
        field: "opens",
        message: `"${next.name}" opens at ${next.opens}, but "${current.name}" closes at ${current.closes}. Sessions overlap.`,
        severity: "error",
      });
    }
  }

  return warnings;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function EventsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const today = startOfToday();
  const [venueFilter, setVenueFilter] = useState<string>("all");

  // Per-date session configuration state
  const [dateSessionConfigs, setDateSessionConfigs] = useState<Map<string, DateSessionConfig>>(new Map());
  const [selectedConfigDate, setSelectedConfigDate] = useState<string | null>(null);
  const [useSameScheduleForAllDays, setUseSameScheduleForAllDays] = useState(true);
  
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const operationalFacilities = useMemo(
    () => facilities.filter((facility) => facility.status === "operational"),
    [facilities]
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);

  // Audience filter state
  const [levels, setLevels] = useState<LevelDto[]>([]);
  const [sections, setSections] = useState<SectionDto[]>([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [selectedLevelIds, setSelectedLevelIds] = useState<Set<string>>(new Set());
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [expandedLevelIds, setExpandedLevelIds] = useState<Set<string>>(new Set());
  
  // Specific students state
  const [allStudents, setAllStudents] = useState<StudentDto[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [excludeStudentSearch, setExcludeStudentSearch] = useState("");
  const [excludeSectionSearch, setExcludeSectionSearch] = useState("");
  
  // Scanner assignments state
  const [scannerUsers, setScannerUsers] = useState<ScannerUser[]>([]);
  const [isLoadingScanners, setIsLoadingScanners] = useState(false);
  const [scannerSearchQuery, setScannerSearchQuery] = useState("");
  const [selectedScannerIds, setSelectedScannerIds] = useState<Set<string>>(new Set());
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Exclusion state
  const [excludedLevelIds, setExcludedLevelIds] = useState<Set<string>>(new Set());
  const [excludedSectionIds, setExcludedSectionIds] = useState<Set<string>>(new Set());
  const [excludedStudentIds, setExcludedStudentIds] = useState<Set<string>>(new Set());
  const [showExclusions, setShowExclusions] = useState(false);

  // Create event form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState<string | null>(null);
  const [createEventTitle, setCreateEventTitle] = useState("");
  const [createEventDescription, setCreateEventDescription] = useState("");
  const [createEventPosterUrl, setCreateEventPosterUrl] = useState("");
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [createEventRange, setCreateEventRange] = useState<DateRange | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");

  // Events list state
  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Events bulk selection state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [isDeletingEvents, setIsDeletingEvents] = useState(false);
  const [isApprovingEvents, setIsApprovingEvents] = useState(false);
  const [isPublishingEvents, setIsPublishingEvents] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Edit event state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isLoadingEditEvent, setIsLoadingEditEvent] = useState(false);

  // Venue availability state
  const [venueAvailability, setVenueAvailability] = useState<VenueAvailabilityResult[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [venueSearchQuery, setVenueSearchQuery] = useState("");

  // Derived: whether we're in edit mode
  const isEditMode = editingEventId !== null;

  // Derived: filtered venues based on search query
  const filteredVenues = useMemo(() => {
    if (!venueSearchQuery.trim()) {
      return venueAvailability;
    }
    const query = venueSearchQuery.toLowerCase();
    return venueAvailability.filter(
      (v) =>
        v.facilityName.toLowerCase().includes(query) ||
        v.facilityLocation.toLowerCase().includes(query)
    );
  }, [venueAvailability, venueSearchQuery]);

  // Derived: venue availability summary
  const venueAvailabilitySummary = useMemo(() => {
    return {
      total: venueAvailability.length,
      available: venueAvailability.filter((v) => v.status === "available").length,
      partial: venueAvailability.filter((v) => v.status === "partial").length,
      unavailable: venueAvailability.filter((v) => v.status === "unavailable").length,
    };
  }, [venueAvailability]);

  useEffect(() => {
    let isCancelled = false;

    async function loadFacilities() {
      setIsLoadingFacilities(true);
      setFacilitiesError(null);

      try {
        const response = await fetch("/api/facilities", {
          method: "GET",
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: { facilities: Facility[] }; error?: { message?: string } }
          | null;

        if (!response.ok || !body) {
          const message = body?.error?.message ?? "Unable to load facilities.";
          throw new Error(message);
        }

        if (!body.success || !body.data) {
          throw new Error("Unexpected response when loading facilities.");
        }

        if (!isCancelled) {
          setFacilities(body.data.facilities);
        }
      } catch (error) {
        if (!isCancelled) {
          const message =
            error instanceof Error ? error.message : "Unable to load facilities.";
          setFacilitiesError(message);
          console.error("[EventsPage] Failed to load facilities", error);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingFacilities(false);
        }
      }
    }

    void loadFacilities();

    return () => {
      isCancelled = true;
    };
  }, []);

  const roleSignature = useMemo(() => (user?.roles ?? []).join("|"), [user?.roles]);

  const isAdminUser = useMemo(
    () => (user?.roles ?? []).some((role) => role === "SUPER_ADMIN" || role === "ADMIN"),
    [user?.roles]
  );

  const resolveEventsEndpoint = useCallback(() => {
    const roles = user?.roles ?? [];

    if (roles.some((role) => role === "SUPER_ADMIN" || role === "ADMIN")) {
      return "/api/sems/events";
    }

    if (roles.some((role) => role === "TEACHER" || role === "STAFF")) {
      return "/api/sems/events/organizer";
    }

    if (roles.includes("STUDENT")) {
      return "/api/sems/events/student";
    }

    if (roles.includes("PARENT")) {
      return "/api/sems/events/parent";
    }

    return "/api/sems/events/public";
  }, [roleSignature, user?.id]);

  // Load events list
  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    setEventsError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (venueFilter && venueFilter !== "all") {
        // Find facility ID by name
        const facility = facilities.find((f) => f.name === venueFilter);
        if (facility) {
          params.set("facilityId", facility.id);
        }
      }
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const endpoint = resolveEventsEndpoint();
      const url = `${endpoint}${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { method: "GET" });

      if (shouldRedirectToLogin(response)) return;

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { events: EventListItem[]; pagination: { total: number } };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.success || !body.data) {
        throw new Error(body?.error?.message ?? "Unable to load events.");
      }

      setEventsList(body.data.events);
      // Reset selection after reload to avoid stale IDs
      setSelectedEventIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load events.";
      setEventsError(message);
      console.error("[EventsPage] Failed to load events", error);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [venueFilter, searchTerm, facilities, resolveEventsEndpoint]);

  // Derived: bulk selection state for events table
  const eventSelectionState = useMemo(() => {
    const visibleIds = eventsList.map((e) => e.id);
    const selectedCount = visibleIds.filter((id) => selectedEventIds.has(id)).length;
    const totalCount = visibleIds.length;

    const allSelected = totalCount > 0 && selectedCount === totalCount;
    const partiallySelected = selectedCount > 0 && selectedCount < totalCount;

    return {
      allSelected,
      partiallySelected,
      hasSelection: selectedEventIds.size > 0,
      selectedCount,
    };
  }, [eventsList, selectedEventIds]);

  const hasOnlyApprovedSelected = useMemo(() => {
    if (selectedEventIds.size === 0) return false;
    const selected = eventsList.filter((e) => selectedEventIds.has(e.id));
    if (selected.length === 0) return false;
    return selected.every((e) => e.lifecycleStatus === "approved");
  }, [eventsList, selectedEventIds]);

  const hasOnlyPendingApprovalSelected = useMemo(() => {
    if (selectedEventIds.size === 0) return false;
    const selected = eventsList.filter((e) => selectedEventIds.has(e.id));
    if (selected.length === 0) return false;
    return selected.every((e) => e.lifecycleStatus === "pending_approval");
  }, [eventsList, selectedEventIds]);

  const handleToggleSelectAllEvents = useCallback(() => {
    const visibleIds = eventsList.map((e) => e.id);
    if (visibleIds.length === 0) return;

    const { allSelected } = eventSelectionState;
    if (allSelected) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(visibleIds));
    }
  }, [eventsList, eventSelectionState]);

  const handleToggleSelectEvent = useCallback((eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const handleDeleteSelectedEvents = useCallback(async () => {
    if (selectedEventIds.size === 0) {
      toast.warning("No events selected", {
        description: "Select one or more events from the list to delete.",
      });
      return;
    }

    setIsDeletingEvents(true);

    try {
      const ids = Array.from(selectedEventIds);
      const response = await fetch("/api/sems/events", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      if (shouldRedirectToLogin(response)) return;

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { deletedCount: number };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.message ?? "Unable to delete events.");
      }

      const deletedCount = body.data?.deletedCount ?? 0;

      setEventsList((prev) => prev.filter((event) => !selectedEventIds.has(event.id)));
      setSelectedEventIds(new Set());

      toast.success("Events deleted", {
        description:
          deletedCount > 0
            ? `${deletedCount} event(s) were removed from the list.`
            : "No events were deleted.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete events.";
      toast.error("Failed to delete events", {
        description: message,
      });
    } finally {
      setIsDeletingEvents(false);
    }
  }, [selectedEventIds]);

  const handleApproveSelectedEvents = useCallback(async () => {
    if (selectedEventIds.size === 0) {
      toast.warning("No events selected", {
        description: "Select one or more events from the list to approve.",
      });
      return;
    }

    const pendingIds = Array.from(selectedEventIds).filter((id) => {
      const event = eventsList.find((e) => e.id === id);
      return event?.lifecycleStatus === "pending_approval";
    });

    if (pendingIds.length === 0) {
      toast.warning("No approvable events selected", {
        description:
          "Only events with lifecycle status 'pending_approval' can be approved.",
      });
      return;
    }

    setIsApprovingEvents(true);

    try {
      let successCount = 0;
      let failureCount = 0;

      for (const id of pendingIds) {
        const response = await fetch("/api/sems/events", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, workflowAction: "APPROVE" }),
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as {
          success?: boolean;
          error?: { message?: string };
        } | null;

        if (!response.ok || !body?.success) {
          failureCount += 1;
          console.error(
            "[EventsPage] Failed to approve event",
            id,
            body?.error?.message
          );
          continue;
        }

        successCount += 1;
      }

      if (successCount > 0) {
        toast.success("Events approved", {
          description:
            successCount === 1
              ? "1 event was approved."
              : `${successCount} events were approved.`,
        });
        setSelectedEventIds(new Set());
        void loadEvents();
      }

      if (failureCount > 0) {
        toast.error("Some events were not approved", {
          description:
            "One or more selected events could not be approved. Check their status and try again.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to approve events.";
      toast.error("Failed to approve events", {
        description: message,
      });
    } finally {
      setIsApprovingEvents(false);
    }
  }, [selectedEventIds, eventsList, loadEvents]);

  const handlePublishSelectedEvents = useCallback(async () => {
    if (selectedEventIds.size === 0) {
      toast.warning("No events selected", {
        description: "Select one or more events from the list to publish.",
      });
      return;
    }

    const approvableIds = Array.from(selectedEventIds).filter((id) => {
      const event = eventsList.find((e) => e.id === id);
      return event?.lifecycleStatus === "approved";
    });

    if (approvableIds.length === 0) {
      toast.warning("No publishable events selected", {
        description:
          "Only events with lifecycle status 'Approved' can be published.",
      });
      return;
    }

    setIsPublishingEvents(true);

    try {
      let successCount = 0;
      let failureCount = 0;

      for (const id of approvableIds) {
        const response = await fetch("/api/sems/events", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, workflowAction: "PUBLISH" }),
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as {
          success?: boolean;
          error?: { message?: string };
        } | null;

        if (!response.ok || !body?.success) {
          failureCount += 1;
          console.error(
            "[EventsPage] Failed to publish event",
            id,
            body?.error?.message
          );
          continue;
        }

        successCount += 1;
      }

      if (successCount > 0) {
        toast.success("Events published", {
          description:
            successCount === 1
              ? "1 event was published."
              : `${successCount} events were published.`,
        });
        setSelectedEventIds(new Set());
        void loadEvents();
      }

      if (failureCount > 0) {
        toast.error("Some events were not published", {
          description:
            "One or more selected events could not be published. Check their lifecycle, registration window, and capacity, then try again.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to publish events.";
      toast.error("Failed to publish events", {
        description: message,
      });
    } finally {
      setIsPublishingEvents(false);
    }
  }, [selectedEventIds, eventsList, loadEvents]);

  // Initial load and refresh on filter changes
  useEffect(() => {
    // Wait for facilities to load before filtering by venue
    if (facilities.length > 0 || venueFilter === "all") {
      void loadEvents();
    }
  }, [loadEvents, facilities.length, venueFilter]);

  /**
   * Reset form to initial state.
   */
  const resetForm = useCallback(() => {
    setCreateEventTitle("");
    setCreateEventDescription("");
    setCreateEventPosterUrl("");
    setCreateEventRange(undefined);
    setSelectedFacilityId("");
    setAudienceMode("all");
    setSelectedLevelIds(new Set());
    setSelectedSectionIds(new Set());
    setSelectedStudentIds(new Set());
    setExcludedLevelIds(new Set());
    setExcludedSectionIds(new Set());
    setExcludedStudentIds(new Set());
    setShowExclusions(false);
    setDateSessionConfigs(new Map());
    setSelectedConfigDate(null);
    setUseSameScheduleForAllDays(true);
    setCreateEventError(null);
    setEditingEventId(null);
    setVenueSearchQuery("");
    setVenueAvailability([]);
    setSelectedScannerIds(new Set());
    setScannerSearchQuery("");
    setScannerError(null);
  }, []);

  const handlePosterFileSelected = async (file: File | null) => {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please select an image file for the event poster.",
      });
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSizeBytes) {
      toast.error("File too large", {
        description: "Poster image must be 5 MB or smaller.",
      });
      return;
    }

    setIsUploadingPoster(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/sems/events/poster-upload", {
        method: "POST",
        body: formData,
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; data?: { url?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !body?.success || !body.data?.url) {
        const message = body?.error?.message ?? "Unable to upload poster image.";
        throw new Error(message);
      }

      setCreateEventPosterUrl(body.data.url);
      toast.success("Poster uploaded", {
        description: "This image will be used when sharing the event.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to upload poster image.";
      toast.error("Poster upload failed", {
        description: message,
      });
    } finally {
      setIsUploadingPoster(false);
    }
  };

  /**
   * Check venue availability when dates or sessions change.
   * 
   * @remarks
   * This effect runs whenever the user changes:
   * - The event date range
   * - The session configuration for any date
   * - The event being edited (to exclude it from conflict checks)
   */
  useEffect(() => {
    // Skip if dialog is not open
    if (!isCreateDialogOpen) return;

    // Skip if no date range selected
    if (!createEventRange?.from) {
      setVenueAvailability([]);
      return;
    }

    let isCancelled = false;

    async function checkAvailability() {
      setIsCheckingAvailability(true);

      try {
        const startDate = format(createEventRange!.from!, "yyyy-MM-dd");
        const endDate = createEventRange?.to
          ? format(createEventRange.to, "yyyy-MM-dd")
          : startDate;

        // Build sessions array from dateSessionConfigs
        const sessions = Array.from(dateSessionConfigs.entries()).map(([dateStr, config]) => ({
          date: dateStr,
          sessions: config.sessions
            .filter((s) => config.enabledPeriods.has(s.period))
            .map((s) => ({
              id: s.id,
              name: s.name,
              period: s.period,
              direction: s.direction,
              opens: s.opens,
              lateAfter: s.supportsLateAfter && s.lateAfter ? s.lateAfter : null,
              closes: s.closes,
            })),
        }));

        // Build query params
        const params = new URLSearchParams();
        params.set("startDate", startDate);
        params.set("endDate", endDate);
        params.set("sessions", JSON.stringify(sessions));
        if (editingEventId) {
          params.set("excludeEventId", editingEventId);
        }

        const response = await fetch(`/api/facilities/availability?${params.toString()}`);

        if (isCancelled) return;

        if (response.ok) {
          const body = await response.json();
          if (body.success && body.data?.venues) {
            setVenueAvailability(body.data.venues);
          }
        } else {
          console.error("[VenueAvailability] Failed to check availability");
          // On error, show all facilities as available (graceful degradation)
          setVenueAvailability(
            operationalFacilities.map((f) => ({
              facilityId: f.id,
              facilityName: f.name,
              facilityLocation: f.location,
              facilityImageUrl: f.imageUrl,
              facilityCapacity: f.capacity,
              status: "available" as const,
              conflicts: [],
              availabilityMap: {},
            }))
          );
        }
      } catch (error) {
        if (isCancelled) return;
        console.error("[VenueAvailability] Error:", error);
      } finally {
        if (!isCancelled) {
          setIsCheckingAvailability(false);
        }
      }
    }

    void checkAvailability();

    return () => {
      isCancelled = true;
    };
  }, [isCreateDialogOpen, createEventRange, dateSessionConfigs, editingEventId, operationalFacilities]);

  // Load scanner-capable users when the dialog opens
  useEffect(() => {
    if (!isCreateDialogOpen) return;
    // Only load once per dialog open while we have no data
    if (scannerUsers.length > 0 || isLoadingScanners) return;

    let isCancelled = false;

    async function loadScanners() {
      setIsLoadingScanners(true);

      try {
        const response = await fetch("/api/sems/scanners", { method: "GET" });

        if (shouldRedirectToLogin(response)) return;

        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: { scanners: ScannerUser[] }; error?: { message?: string } }
          | null;

        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.error?.message ?? "Unable to load scanners.");
        }

        if (!isCancelled) {
          setScannerUsers(body.data.scanners);
        }
      } catch (error) {
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : "Unable to load scanners.";
          setScannerError(message);
          console.error("[EventsPage] Failed to load scanners", error);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingScanners(false);
        }
      }
    }

    void loadScanners();

    return () => {
      isCancelled = true;
      // Ensure we don't leave the UI stuck in a loading state when the dialog closes
      setIsLoadingScanners(false);
    };
  }, [isCreateDialogOpen, scannerUsers.length]);

  /**
   * Open edit dialog and load event data.
   */
  const openEditDialog = useCallback(async (eventId: string) => {
    setIsLoadingEditEvent(true);
    setCreateEventError(null);
    setEditingEventId(eventId);
    setIsCreateDialogOpen(true);

    try {
      // Fetch full event data
      const response = await fetch(`/api/sems/events/${eventId}`, { method: "GET" });

      if (shouldRedirectToLogin(response)) return;

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { event: EventEditData };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.success || !body.data) {
        throw new Error(body?.error?.message ?? "Unable to load event.");
      }

      const event = body.data.event;

      // Set scanner assignments
      if (event.scannerConfig?.scannerIds && Array.isArray(event.scannerConfig.scannerIds)) {
        setSelectedScannerIds(new Set(event.scannerConfig.scannerIds));
      } else {
        setSelectedScannerIds(new Set());
      }

      // Populate form with event data
      setCreateEventTitle(event.title);
      setCreateEventDescription(event.description ?? "");
      setCreateEventPosterUrl(event.posterImageUrl ?? "");
      
      // Set date range, preferring sessionConfig.dates if available.
      // This avoids blank session UI when start_date/end_date drift from session_config.
      const sessionDates = event.sessionConfig?.dates?.map((d) => d.date).filter(Boolean) ?? [];

      if (sessionDates.length > 0) {
        const sortedDates = [...sessionDates].sort();
        const start = new Date(sortedDates[0]);
        const end = new Date(sortedDates[sortedDates.length - 1]);
        setCreateEventRange({ from: start, to: end });
      } else if (event.startDate) {
        const start = new Date(event.startDate);
        const end = event.endDate ? new Date(event.endDate) : start;
        setCreateEventRange({ from: start, to: end });
      } else {
        setCreateEventRange(undefined);
      }

      // Set facility
      if (event.facility) {
        setSelectedFacilityId(event.facility.id);
      }

      // Derive session schedule mode from existing session config
      setUseSameScheduleForAllDays(
        haveUniformSessionSchedule(event.sessionConfig?.dates)
      );

      // Set audience mode and selections from audienceConfig
      const audienceConfig = event.audienceConfig;
      if (audienceConfig?.rules) {
        const includeRules = audienceConfig.rules.filter((r) => r.effect === "include");
        const excludeRules = audienceConfig.rules.filter((r) => r.effect === "exclude");

        // Determine mode
        if (includeRules.some((r) => r.kind === "ALL_STUDENTS")) {
          setAudienceMode("all");
        } else {
          const hasLevels = includeRules.some((r) => r.kind === "LEVEL");
          const hasSections = includeRules.some((r) => r.kind === "SECTION");
          const hasStudents = includeRules.some((r) => r.kind === "STUDENT");
          
          if (hasStudents && (hasLevels || hasSections)) {
            setAudienceMode("mixed");
          } else if (hasStudents) {
            setAudienceMode("students");
          } else {
            setAudienceMode("level_section");
          }
        }

        // Set level and section selections
        const levelIds = new Set<string>();
        const sectionIds = new Set<string>();

        includeRules.forEach((rule) => {
          if (rule.kind === "LEVEL" && "levelIds" in rule) {
            rule.levelIds.forEach((levelId) => {
              levelIds.add(levelId);
              // Select all sections under this level so the UI treats it as fully selected
              sections
                .filter((s) => s.levelId === levelId)
                .forEach((s) => sectionIds.add(s.id));
            });
          } else if (rule.kind === "SECTION" && "sectionIds" in rule) {
            rule.sectionIds.forEach((sectionId) => sectionIds.add(sectionId));
          }
        });

        setSelectedLevelIds(levelIds);
        setSelectedSectionIds(sectionIds);

        // Set student selections
        const studentIds = new Set<string>();
        includeRules.filter((r) => r.kind === "STUDENT").forEach((r) => {
          if ("studentIds" in r) r.studentIds.forEach((id) => studentIds.add(id));
        });
        setSelectedStudentIds(studentIds);

        // Set exclusions
        const exLevelIds = new Set<string>();
        excludeRules.filter((r) => r.kind === "LEVEL").forEach((r) => {
          if ("levelIds" in r) r.levelIds.forEach((id) => exLevelIds.add(id));
        });
        setExcludedLevelIds(exLevelIds);

        const exSectionIds = new Set<string>();
        excludeRules.filter((r) => r.kind === "SECTION").forEach((r) => {
          if ("sectionIds" in r) r.sectionIds.forEach((id) => exSectionIds.add(id));
        });
        setExcludedSectionIds(exSectionIds);

        const exStudentIds = new Set<string>();
        excludeRules.filter((r) => r.kind === "STUDENT").forEach((r) => {
          if ("studentIds" in r) r.studentIds.forEach((id) => exStudentIds.add(id));
        });
        setExcludedStudentIds(exStudentIds);

        // Show exclusions panel if there are any
        if (exLevelIds.size > 0 || exSectionIds.size > 0 || exStudentIds.size > 0) {
          setShowExclusions(true);
        }
      }

      // Set session config
      if (event.sessionConfig?.dates) {
        const configMap = new Map<string, DateSessionConfig>();

        for (const dateConfig of event.sessionConfig.dates) {
          const enabledPeriods = new Set<SessionPeriod>();
          const sessions = DEFAULT_SESSION_CONFIGS.map((defaultSession) => {
            const existingSession = dateConfig.sessions.find((s) => s.id === defaultSession.id);
            if (existingSession) {
              enabledPeriods.add(existingSession.period);
              return {
                ...defaultSession,
                opens: existingSession.opens,
                lateAfter: existingSession.lateAfter ?? "",
                closes: existingSession.closes,
              };
            }
            return { ...defaultSession };
          });

          configMap.set(dateConfig.date, {
            date: dateConfig.date,
            enabledPeriods,
            sessions,
          });
        }

        setDateSessionConfigs(configMap);
      }
    } catch (error) {
      console.error("[EventsPage] Failed to load event for editing", error);
      setCreateEventError(
        error instanceof Error ? error.message : "Unable to load event for editing."
      );
    } finally {
      setIsLoadingEditEvent(false);
    }
  }, []);

  // Load students for specific students mode and exclusions
  useEffect(() => {
    if (
      audienceMode !== "students" &&
      audienceMode !== "mixed" &&
      !showExclusions
    ) {
      return;
    }
    if (allStudents.length > 0) return; // Already loaded

    let isCancelled = false;

    async function loadStudents() {
      setIsLoadingStudents(true);

      try {
        const response = await fetch("/api/sis/students", { method: "GET" });

        if (shouldRedirectToLogin(response)) return;

        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: { students: StudentDto[] }; error?: { message?: string } }
          | null;

        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.error?.message ?? "Unable to load students.");
        }

        if (!isCancelled) {
          setAllStudents(body.data.students);
        }
      } catch (error) {
        console.error("[EventsPage] Failed to load students", error);
      } finally {
        if (!isCancelled) setIsLoadingStudents(false);
      }
    }

    void loadStudents();

    return () => {
      isCancelled = true;
    };
  }, [audienceMode, allStudents.length, showExclusions]);

  // Helper: Get sections for a level
  const getSectionsForLevel = useCallback(
    (levelId: string) => sections.filter((s) => s.levelId === levelId),
    [sections]
  );

  // Helper: Check if all sections of a level are selected
  const isLevelFullySelected = useCallback(
    (levelId: string) => {
      const levelSections = getSectionsForLevel(levelId);
      if (levelSections.length === 0) return selectedLevelIds.has(levelId);
      return levelSections.every((s) => selectedSectionIds.has(s.id));
    },
    [getSectionsForLevel, selectedLevelIds, selectedSectionIds]
  );

  // Helper: Check if some (but not all) sections of a level are selected
  const isLevelPartiallySelected = useCallback(
    (levelId: string) => {
      const levelSections = getSectionsForLevel(levelId);
      if (levelSections.length === 0) return false;
      const selectedCount = levelSections.filter((s) => selectedSectionIds.has(s.id)).length;
      return selectedCount > 0 && selectedCount < levelSections.length;
    },
    [getSectionsForLevel, selectedSectionIds]
  );

  // Toggle level selection (selects/deselects all its sections)
  const toggleLevelSelection = useCallback(
    (levelId: string) => {
      const levelSections = getSectionsForLevel(levelId);
      const isFullySelected = isLevelFullySelected(levelId);

      if (isFullySelected) {
        // Deselect level and all its sections
        setSelectedLevelIds((prev) => {
          const next = new Set(prev);
          next.delete(levelId);
          return next;
        });
        setSelectedSectionIds((prev) => {
          const next = new Set(prev);
          levelSections.forEach((s) => next.delete(s.id));
          return next;
        });
      } else {
        // Select level and all its sections
        setSelectedLevelIds((prev) => new Set(prev).add(levelId));
        setSelectedSectionIds((prev) => {
          const next = new Set(prev);
          levelSections.forEach((s) => next.add(s.id));
          return next;
        });
      }
    },
    [getSectionsForLevel, isLevelFullySelected]
  );

  // Toggle individual section selection
  const toggleSectionSelection = useCallback(
    (sectionId: string, levelId: string) => {
      setSelectedSectionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) {
          next.delete(sectionId);
        } else {
          next.add(sectionId);
        }
        return next;
      });

      // Update level selection state based on sections
      const levelSections = getSectionsForLevel(levelId);
      setSelectedSectionIds((currentSections) => {
        const allSelected = levelSections.every((s) => currentSections.has(s.id));
        setSelectedLevelIds((prevLevels) => {
          const nextLevels = new Set(prevLevels);
          if (allSelected) {
            nextLevels.add(levelId);
          } else {
            nextLevels.delete(levelId);
          }
          return nextLevels;
        });
        return currentSections;
      });
    },
    [getSectionsForLevel]
  );

  // Toggle level expansion
  const toggleLevelExpansion = useCallback((levelId: string) => {
    setExpandedLevelIds((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) {
        next.delete(levelId);
      } else {
        next.add(levelId);
      }
      return next;
    });
  }, []);

  // Filter students based on search query
  const filteredStudents = allStudents.filter((student) => {
    if (!studentSearchQuery.trim()) return true;
    const query = studentSearchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.lrn.toLowerCase().includes(query) ||
      student.grade.toLowerCase().includes(query) ||
      student.section.toLowerCase().includes(query)
    );
  });

  const filteredScanners = useMemo(() => {
    if (!scannerSearchQuery.trim()) return scannerUsers;
    const query = scannerSearchQuery.toLowerCase();
    return scannerUsers.filter((user) =>
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  }, [scannerUsers, scannerSearchQuery]);

  // Filter sections for exclusion search
  const excludeFilteredSections = sections.filter((section) => {
    if (!excludeSectionSearch.trim()) return true;
    const query = excludeSectionSearch.toLowerCase();
    const level = levels.find((l) => l.id === section.levelId);
    return (
      section.name.toLowerCase().includes(query) ||
      (level?.name.toLowerCase().includes(query) ?? false)
    );
  });

  // Filter students for exclusion search
  const excludeFilteredStudents = allStudents.filter((student) => {
    if (!excludeStudentSearch.trim()) return true;
    const query = excludeStudentSearch.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.lrn.toLowerCase().includes(query) ||
      student.grade.toLowerCase().includes(query) ||
      student.section.toLowerCase().includes(query)
    );
  });

  // Build audience config JSON from current state
  const buildAudienceConfig = useCallback((): EventAudienceConfig => {
    const rules: AudienceRule[] = [];

    if (audienceMode === "all") {
      rules.push({ kind: "ALL_STUDENTS", effect: "include" });
    } else if (audienceMode === "level_section") {
      // Include selected levels (where all sections are selected)
      const fullySelectedLevelIds = levels
        .filter((l) => isLevelFullySelected(l.id))
        .map((l) => l.id);

      if (fullySelectedLevelIds.length > 0) {
        rules.push({ kind: "LEVEL", effect: "include", levelIds: fullySelectedLevelIds });
      }

      // Include sections that are selected but their level is not fully selected
      const partialSectionIds = Array.from(selectedSectionIds).filter((sId) => {
        const section = sections.find((s) => s.id === sId);
        if (!section || !section.levelId) return true;
        return !fullySelectedLevelIds.includes(section.levelId);
      });

      if (partialSectionIds.length > 0) {
        rules.push({ kind: "SECTION", effect: "include", sectionIds: partialSectionIds });
      }
    } else if (audienceMode === "students") {
      if (selectedStudentIds.size > 0) {
        rules.push({ kind: "STUDENT", effect: "include", studentIds: Array.from(selectedStudentIds) });
      }
    } else if (audienceMode === "mixed") {
      // Levels
      const fullySelectedLevelIds = levels
        .filter((l) => isLevelFullySelected(l.id))
        .map((l) => l.id);

      if (fullySelectedLevelIds.length > 0) {
        rules.push({ kind: "LEVEL", effect: "include", levelIds: fullySelectedLevelIds });
      }

      // Sections
      const partialSectionIds = Array.from(selectedSectionIds).filter((sId) => {
        const section = sections.find((s) => s.id === sId);
        if (!section || !section.levelId) return true;
        return !fullySelectedLevelIds.includes(section.levelId);
      });

      if (partialSectionIds.length > 0) {
        rules.push({ kind: "SECTION", effect: "include", sectionIds: partialSectionIds });
      }

      // Students
      if (selectedStudentIds.size > 0) {
        rules.push({ kind: "STUDENT", effect: "include", studentIds: Array.from(selectedStudentIds) });
      }
    }

    // Add exclusion rules
    if (excludedLevelIds.size > 0) {
      rules.push({ kind: "LEVEL", effect: "exclude", levelIds: Array.from(excludedLevelIds) });
    }
    if (excludedSectionIds.size > 0) {
      rules.push({ kind: "SECTION", effect: "exclude", sectionIds: Array.from(excludedSectionIds) });
    }
    if (excludedStudentIds.size > 0) {
      rules.push({ kind: "STUDENT", effect: "exclude", studentIds: Array.from(excludedStudentIds) });
    }

    return { version: 1, rules };
  }, [
    audienceMode,
    levels,
    sections,
    selectedSectionIds,
    selectedStudentIds,
    excludedLevelIds,
    excludedSectionIds,
    excludedStudentIds,
    isLevelFullySelected,
  ]);

  // Build audience summary for display
  const getAudienceSummary = useCallback((): string => {
    if (audienceMode === "all") {
      if (excludedStudentIds.size > 0 || excludedSectionIds.size > 0 || excludedLevelIds.size > 0) {
        const exclusions: string[] = [];
        if (excludedLevelIds.size > 0) exclusions.push(`${excludedLevelIds.size} level(s)`);
        if (excludedSectionIds.size > 0) exclusions.push(`${excludedSectionIds.size} section(s)`);
        if (excludedStudentIds.size > 0) exclusions.push(`${excludedStudentIds.size} student(s)`);
        return `All students except ${exclusions.join(", ")}`;
      }
      return "All students";
    }

    const parts: string[] = [];

    if (audienceMode === "level_section" || audienceMode === "mixed") {
      const fullySelectedLevels = levels.filter((l) => isLevelFullySelected(l.id));
      const partialLevels = levels.filter((l) => isLevelPartiallySelected(l.id));

      if (fullySelectedLevels.length > 0) {
        parts.push(fullySelectedLevels.map((l) => l.name).join(", "));
      }

      if (partialLevels.length > 0) {
        partialLevels.forEach((level) => {
          const levelSections = getSectionsForLevel(level.id).filter((s) => selectedSectionIds.has(s.id));
          if (levelSections.length > 0) {
            parts.push(`${level.name}: ${levelSections.map((s) => s.name).join(", ")}`);
          }
        });
      }
    }

    if ((audienceMode === "students" || audienceMode === "mixed") && selectedStudentIds.size > 0) {
      parts.push(`${selectedStudentIds.size} specific student(s)`);
    }

    if (parts.length === 0) {
      return "No audience selected";
    }

    let summary = parts.join(" + ");

    if (excludedStudentIds.size > 0 || excludedSectionIds.size > 0 || excludedLevelIds.size > 0) {
      const exclusions: string[] = [];
      if (excludedLevelIds.size > 0) exclusions.push(`${excludedLevelIds.size} level(s)`);
      if (excludedSectionIds.size > 0) exclusions.push(`${excludedSectionIds.size} section(s)`);
      if (excludedStudentIds.size > 0) exclusions.push(`${excludedStudentIds.size} student(s)`);
      summary += ` (excluding ${exclusions.join(", ")})`;
    }

    return summary;
  }, [
    audienceMode,
    levels,
    selectedSectionIds,
    selectedStudentIds,
    excludedLevelIds,
    excludedSectionIds,
    excludedStudentIds,
    isLevelFullySelected,
    isLevelPartiallySelected,
    getSectionsForLevel,
  ]);

  const buildScannerConfigJson = useCallback((): string => {
    const ids = Array.from(selectedScannerIds);
    return JSON.stringify({
      version: 1,
      scannerIds: ids,
    });
  }, [selectedScannerIds]);

  // Compute list of dates from the selected range
  const eventDates = useMemo((): Date[] => {
    if (!createEventRange?.from) return [];
    const start = createEventRange.from;
    const end = createEventRange.to ?? createEventRange.from;
    return eachDayOfInterval({ start, end });
  }, [createEventRange]);

  // Initialize date configs when range changes
  useEffect(() => {
    if (eventDates.length === 0) {
      setDateSessionConfigs(new Map());
      setSelectedConfigDate(null);
      return;
    }

    setDateSessionConfigs((prev) => {
      const next = new Map<string, DateSessionConfig>();
      for (const d of eventDates) {
        const dateStr = format(d, "yyyy-MM-dd");
        // Preserve existing config if present, otherwise create default
        if (prev.has(dateStr)) {
          next.set(dateStr, prev.get(dateStr)!);
        } else {
          next.set(dateStr, createDefaultDateConfig(dateStr));
        }
      }
      return next;
    });

    // Auto-select first date if none selected or selected date is no longer in range
    setSelectedConfigDate((prev) => {
      const firstDateStr = format(eventDates[0], "yyyy-MM-dd");
      if (!prev) return firstDateStr;
      const stillInRange = eventDates.some((d) => format(d, "yyyy-MM-dd") === prev);
      return stillInRange ? prev : firstDateStr;
    });
  }, [eventDates]);

  // Get current date's config
  const currentDateConfig = useMemo((): DateSessionConfig | null => {
    if (!selectedConfigDate) return null;
    return dateSessionConfigs.get(selectedConfigDate) ?? null;
  }, [selectedConfigDate, dateSessionConfigs]);

  // Compute session time warnings for real-time validation
  const sessionTimeWarnings = useMemo((): SessionTimeWarning[] => {
    if (!currentDateConfig) return [];
    return detectSessionTimeConflicts(
      currentDateConfig.sessions,
      currentDateConfig.enabledPeriods
    );
  }, [currentDateConfig]);

  // Helper to get warnings for a specific session
  const getWarningsForSession = useCallback(
    (sessionId: string): SessionTimeWarning[] => {
      return sessionTimeWarnings.filter((w) => w.sessionId === sessionId);
    },
    [sessionTimeWarnings]
  );

  // Toggle period for the selected date
  const toggleSessionPeriod = useCallback(
    (period: SessionPeriod) => {
      if (!selectedConfigDate) return;
      setDateSessionConfigs((prev) => {
        const next = new Map(prev);

        if (useSameScheduleForAllDays) {
          for (const [dateStr, config] of next.entries()) {
            const newEnabledPeriods = new Set(config.enabledPeriods);
            if (newEnabledPeriods.has(period)) {
              newEnabledPeriods.delete(period);
            } else {
              newEnabledPeriods.add(period);
            }
            next.set(dateStr, { ...config, enabledPeriods: newEnabledPeriods });
          }
          return next;
        }

        const config = next.get(selectedConfigDate);
        if (!config) return prev;
        const newEnabledPeriods = new Set(config.enabledPeriods);
        if (newEnabledPeriods.has(period)) {
          newEnabledPeriods.delete(period);
        } else {
          newEnabledPeriods.add(period);
        }
        next.set(selectedConfigDate, { ...config, enabledPeriods: newEnabledPeriods });
        return next;
      });
    },
    [selectedConfigDate, useSameScheduleForAllDays],
  );

  // Update session time for the selected date
  const updateSessionTime = useCallback(
    (sessionId: string, field: "opens" | "lateAfter" | "closes", value: string) => {
      if (!selectedConfigDate) return;
      setDateSessionConfigs((prev) => {
        const next = new Map(prev);

        if (useSameScheduleForAllDays) {
          for (const [dateStr, config] of next.entries()) {
            const newSessionsForAll = config.sessions.map((session) =>
              session.id === sessionId ? { ...session, [field]: value } : session,
            );
            next.set(dateStr, { ...config, sessions: newSessionsForAll });
          }
          return next;
        }

        const config = next.get(selectedConfigDate);
        if (!config) return prev;
        const newSessions = config.sessions.map((session) =>
          session.id === sessionId ? { ...session, [field]: value } : session,
        );
        next.set(selectedConfigDate, { ...config, sessions: newSessions });
        return next;
      });
    },
    [selectedConfigDate, useSameScheduleForAllDays],
  );

  // Build version 2 session config JSON with per-date sessions
  const buildSessionConfigJson = useCallback((): string => {
    const dates = Array.from(dateSessionConfigs.entries()).map(([dateStr, config]) => ({
      date: dateStr,
      sessions: config.sessions
        .filter((session) => config.enabledPeriods.has(session.period))
        .map((session) => ({
          id: session.id,
          name: session.name,
          period: session.period,
          direction: session.direction,
          opens: session.opens,
          lateAfter: session.supportsLateAfter && session.lateAfter ? session.lateAfter : null,
          closes: session.closes,
        })),
    }));

    return JSON.stringify({
      version: 2,
      dates,
    });
  }, [dateSessionConfigs]);

  /**
   * Validate all dates for session time conflicts.
   * Returns the first error message if any date has conflicts, otherwise null.
   */
  const validateAllSessionConfigs = useCallback((): string | null => {
    for (const [dateStr, config] of dateSessionConfigs.entries()) {
      const warnings = detectSessionTimeConflicts(config.sessions, config.enabledPeriods);
      const errors = warnings.filter((w) => w.severity === "error");
      if (errors.length > 0) {
        const formattedDate = format(new Date(dateStr), "MMM d, yyyy");
        return `${formattedDate}: ${errors[0].message}`;
      }
    }
    return null;
  }, [dateSessionConfigs]);

  /**
   * Handle Create/Update Event form submission.
   * 
   * Calls POST or PUT /api/sems/events based on edit mode.
   */
  const handleEventFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateEventError(null);
    const isUpdate = Boolean(editingEventId);

    // Validate session time conflicts before submission
    const sessionError = validateAllSessionConfigs();
    if (sessionError) {
      toast.error("Session time conflict", {
        description: sessionError,
      });
      return;
    }

    if (isCheckingAvailability) {
      toast.warning("Checking venue availability", {
        description: "Please wait for the availability check to finish before saving the event.",
      });
      return;
    }

    if (selectedFacilityId) {
      const selectedVenue = venueAvailability.find(
        (v) => v.facilityId === selectedFacilityId,
      );

      if (selectedVenue && (selectedVenue.status === "unavailable" || selectedVenue.conflicts.length > 0)) {
        const firstConflict = selectedVenue.conflicts[0];
        const conflictSummary = firstConflict
          ? `${firstConflict.date} • ${firstConflict.timeRange} • ${firstConflict.conflictingEventTitle}`
          : undefined;

        toast.error("Venue has conflicting sessions", {
          description:
            conflictSummary ??
            "The selected venue is not available for one or more of the configured sessions.",
        });
        return;
      }
    }

    setIsCreatingEvent(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      const payload: Record<string, unknown> = {
        title: formData.get("title") as string,
        description: formData.get("description") as string || undefined,
        posterImageUrl: formData.get("posterImageUrl") as string || undefined,
        startDate: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        facilityId: formData.get("facilityId") as string || undefined,
        audienceConfigJson: formData.get("audienceConfigJson") as string,
        sessionConfigJson: formData.get("sessionConfigJson") as string,
        scannerConfigJson: formData.get("scannerConfigJson") as string,
      };

      // Add ID if editing
      if (editingEventId) {
        payload.id = editingEventId;
      }

      const response = await fetch("/api/sems/events", {
        method: editingEventId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = await response.json().catch(() => null) as {
        success?: boolean;
        data?: { event: unknown };
        error?: { message?: string; details?: Array<{ field: string; message: string }> };
      } | null;

      if (!response.ok || !body?.success) {
        // Extract error message
        let errorMessage = body?.error?.message ?? (editingEventId ? "Unable to update event." : "Unable to create event.");
        
        // If validation errors, show the first one
        if (body?.error?.details && body.error.details.length > 0) {
          const firstError = body.error.details[0];
          errorMessage = `${firstError.field}: ${firstError.message}`;
        }
        
        throw new Error(errorMessage);
      }

      // Success - close dialog, notify, and reset form
      setIsCreateDialogOpen(false);
      toast.success(isUpdate ? "Event updated" : "Event created", {
        description: isUpdate
          ? "The event details have been saved."
          : "The new event has been added to the schedule.",
      });
      resetForm();

      // Refresh events list
      void loadEvents();
      console.log(`[EventsPage] Event ${editingEventId ? "updated" : "created"} successfully:`, body.data?.event);

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : editingEventId
          ? "Unable to update event."
          : "Unable to create event.";
      setCreateEventError(message);
      toast.error(editingEventId ? "Unable to update event" : "Unable to create event", {
        description: message,
      });
      console.error(
        `[EventsPage] Failed to ${editingEventId ? "update" : "create"} event:`,
        error,
      );
    } finally {
      setIsCreatingEvent(false);
    }
  }, [
    editingEventId,
    loadEvents,
    resetForm,
    validateAllSessionConfigs,
    isCheckingAvailability,
    selectedFacilityId,
    venueAvailability,
    selectedScannerIds,
  ]);

  // Show loading state while validating session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B4D3E] mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  // RBAC Guard - allow admins, super admins, teachers, and staff to view the Events module
  const hasAccess = user?.roles.some(
    (role) =>
      role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "TEACHER" ||
      role === "STAFF"
  );

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center space-y-4 p-8 bg-card rounded-xl shadow-lg border border-red-100 max-w-md">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to view the Events module. Please contact your system administrator.
          </p>
          <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col space-y-6 min-h-0 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 w-full">
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Events Management</h1>
              <p className="text-sm text-muted-foreground">
                Offline-capable, QR-based attendance for school events, assemblies, and gate entries.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 w-full md:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/sems/scan")}
              className="text-sm px-4 py-2 rounded-lg border-border bg-card text-muted-foreground hover:border-emerald-300 hover:text-emerald-800 shadow-sm w-full sm:w-auto"
            >
              My Scanner Events
            </Button>
            <Button
              type="button"
              onClick={() => {
                resetForm();
                setIsCreateDialogOpen(true);
              }}
              className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto"
            >
              + Create Event
            </Button>
          </div>
        </div>

        <Card className="flex-1 flex flex-col w-full border-border shadow-sm">
          <CardHeader className="border-b border-border/80 pb-4 bg-card/95">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">List of Events</CardTitle>
                <CardDescription>Events scheduled for today with live status.</CardDescription>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2 w-full">
                {eventSelectionState.hasSelection && (
                  <span className="text-xs text-muted-foreground">
                    {eventSelectionState.selectedCount} selected
                  </span>
                )}

                {isAdminUser && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={!hasOnlyPendingApprovalSelected || isApprovingEvents}
                            onClick={() => void handleApproveSelectedEvents()}
                            className="rounded-full border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Approve selected events"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Approve selected events</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={!hasOnlyApprovedSelected || isPublishingEvents}
                            onClick={() => void handlePublishSelectedEvents()}
                            className="rounded-full border-sky-300 text-sky-600 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Publish selected events"
                          >
                            <Megaphone className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Publish selected events</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}

                {isAdminUser && (
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open: boolean) => {
                    if (!isDeletingEvents) setIsDeleteDialogOpen(open);
                  }}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={!eventSelectionState.hasSelection || isDeletingEvents}
                              className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label="Delete selected events"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete selected events</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete selected events?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the selected events and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingEvents}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isDeletingEvents}
                          onClick={async () => {
                            await handleDeleteSelectedEvents();
                            setIsDeleteDialogOpen(false);
                          }}
                        >
                          {isDeletingEvents ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <div className="w-full lg:w-auto">
                  <Select value={venueFilter} onValueChange={setVenueFilter}>
                    <SelectTrigger className="w-full min-w-[160px] pl-3 pr-9 py-2 text-sm border border-border rounded-full bg-card text-muted-foreground shadow-sm">
                      <SelectValue placeholder="All venues" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All venues</SelectItem>
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.name}>
                          {facility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search events..."
                  className="w-full lg:w-56 px-3 py-2 text-sm border border-border rounded-full bg-card text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6 hide-scrollbar">
              <Table className="w-full min-w-[720px]">
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={eventSelectionState.allSelected}
                        ref={(el) => {
                          if (el) {
                            (el as unknown as HTMLInputElement).indeterminate =
                              eventSelectionState.partiallySelected;
                          }
                        }}
                        onCheckedChange={handleToggleSelectAllEvents}
                        className="data-[state=checked]:bg-[#1B4D3E] data-[state=checked]:border-[#1B4D3E]"
                        aria-label="Select all events"
                      />
                    </TableHead>
                    <TableHead className="font-bold text-primary">Event Name</TableHead>
                    <TableHead className="font-bold text-primary">Date</TableHead>
                    <TableHead className="font-bold text-primary">Time</TableHead>
                    <TableHead className="font-bold text-primary">Venue</TableHead>
                    <TableHead className="font-bold text-primary">Audience</TableHead>
                    <TableHead className="font-bold text-primary">Scanners</TableHead>
                    <TableHead className="text-right font-bold text-primary">Attendees</TableHead>
                    <TableHead className="text-right font-bold text-primary">Lifecycle</TableHead>
                    <TableHead className="text-right font-bold text-primary">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody
                  key={`${venueFilter}-${searchTerm}-${eventsList.length}`}
                  className="table-filter-animate"
                >
                  {isLoadingEvents ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <span className="h-4 w-4 border-2 border-gray-300 border-t-[#1B4D3E] rounded-full animate-spin" />
                          Loading events...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : eventsError ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <p className="text-red-500">{eventsError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => void loadEvents()}
                        >
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : eventsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No events found. Create your first event to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eventsList.map((event) => {
                      // Format date: "Nov 27" or "Nov 27 - 28" for multi-day
                      const formatEventDate = () => {
                        if (!event.startDate) return "—";
                        const start = new Date(event.startDate);
                        const startStr = format(start, "MMM d");

                        if (!event.endDate || event.startDate === event.endDate) {
                          return startStr;
                        }

                        const end = new Date(event.endDate);
                        // Same month: "Nov 27 - 28"
                        if (start.getMonth() === end.getMonth()) {
                          return `${startStr} - ${format(end, "d")}`;
                        }
                        // Different month: "Nov 27 - Dec 2"
                        return `${startStr} - ${format(end, "MMM d")}`;
                      };

                      const isPublished = event.lifecycleStatus === "published";

                      return (
                        <TableRow
                          key={event.id}
                          onClick={() => {
                            if (!isPublished) {
                              void openEditDialog(event.id);
                            }
                          }}
                          className={cn(
                            "transition-all duration-150",
                            isPublished
                              ? "cursor-default opacity-90"
                              : "cursor-pointer hover:bg-card hover:shadow-sm hover:-translate-y-0.5 hover:border-border/50"
                          )}
                        >
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedEventIds.has(event.id)}
                              onCheckedChange={() => handleToggleSelectEvent(event.id)}
                              className="data-[state=checked]:bg-[#1B4D3E] data-[state=checked]:border-[#1B4D3E]"
                              aria-label="Select event"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{event.title}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{formatEventDate()}</TableCell>
                          <TableCell className="text-muted-foreground">{event.timeRange}</TableCell>
                          <TableCell className="text-muted-foreground">{event.venue ?? ""}</TableCell>
                          <TableCell className="text-muted-foreground">{event.audienceSummary}</TableCell>
                          <TableCell className="text-muted-foreground">{event.scannerSummary}</TableCell>
                          <TableCell className="text-right font-medium">
                            {event.actualAttendees} / {event.expectedAttendees}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "inline-flex items-center justify-end px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                getLifecycleBadgeClasses(event.lifecycleStatus)
                              )}
                            >
                              {formatLifecycleStatus(event.lifecycleStatus)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${
                                event.status === "live"
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/70 animate-pulse"
                                  : event.status === "completed"
                                  ? "bg-muted text-muted-foreground border-border/70"
                                  : "bg-amber-500/15 text-amber-300 border-amber-400/70"
                              }`}
                            >
                              {event.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <EventAttendanceInsights events={eventsList.map((event) => ({
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
      }))}
      />

      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl border border-border/50 dialog-panel-animate">
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {isEditMode ? "Edit Event" : "Create Event"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isEditMode
                    ? "Update the event details, target audience, and session timing."
                    : "Configure the event details, target audience, and session timing."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close event dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="px-6 pb-5 pt-4 space-y-6 max-h-[70vh] overflow-y-auto hide-scrollbar"
              onSubmit={handleEventFormSubmit}
            >
              {/* Loading state for edit mode */}
              {isLoadingEditEvent && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-4 w-4 border-2 border-gray-300 border-t-[#1B4D3E] rounded-full animate-spin" />
                    Loading event data...
                  </div>
                </div>
              )}

              {/* Error display */}
              {createEventError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{createEventError}</p>
                </div>
              )}

              {/* Event Title */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground">Event Title</label>
                <input
                  name="title"
                  type="text"
                  required
                  value={createEventTitle}
                  onChange={(e) => setCreateEventTitle(e.target.value)}
                  placeholder="e.g. Foundation Day"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  disabled={isCreatingEvent}
                />
              </div>

              {/* Event Description */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground">
                  Event Description
                  <span className="ml-1 text-xs text-muted-foreground/70">(used for social media sharing)</span>
                </label>
                <textarea
                  name="description"
                  value={createEventDescription}
                  onChange={(e) => setCreateEventDescription(e.target.value)}
                  placeholder="Describe this event for social media posts and public announcements..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70 resize-none"
                  disabled={isCreatingEvent}
                />
              </div>

              {/* Event Poster Image */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground">
                  Event Poster Image
                  <span className="ml-1 text-xs text-muted-foreground/70">(for social media sharing)</span>
                </label>
                <div
                  className={cn(
                    "mt-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground transition-colors",
                    isUploadingPoster || isCreatingEvent
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted/60"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0] ?? null;
                    void handlePosterFileSelected(file);
                  }}
                >
                  <label
                    htmlFor="poster-file-input"
                    className="flex flex-col items-center justify-center gap-1.5 text-center"
                  >
                    <input
                      id="poster-file-input"
                      type="file"
                      name="poster-file-input"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingPoster || isCreatingEvent}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        void handlePosterFileSelected(file);
                        // Allow selecting the same file again if needed
                        e.target.value = "";
                      }}
                    />
                    <span className="text-xs font-medium">
                      {isUploadingPoster
                        ? "Uploading poster..."
                        : "Click to select or drop an image file here"}
                    </span>
                    <span className="text-[11px] text-muted-foreground/80">
                      JPG, PNG, or WEBP up to 5 MB.
                    </span>
                  </label>
                </div>
                {createEventPosterUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted/50">
                    <img
                      src={createEventPosterUrl}
                      alt="Event poster preview"
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/70">
                  This image will be reused for social media posts on parent and student pages.
                </p>
              </div>

              {/* Hidden fields for form submission */}
              <input type="hidden" name="posterImageUrl" value={createEventPosterUrl} />
              <input type="hidden" name="facilityId" value={selectedFacilityId} />
              <input
                type="hidden"
                name="startDate"
                value={createEventRange?.from ? createEventRange.from.toISOString().slice(0, 10) : ""}
              />
              <input
                type="hidden"
                name="endDate"
                value={createEventRange?.to
                  ? createEventRange.to.toISOString().slice(0, 10)
                  : createEventRange?.from
                  ? createEventRange.from.toISOString().slice(0, 10)
                  : ""}
              />

              {/* Audience Filter - Full Width */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Audience Filter</p>
                    <p className="text-xs text-muted-foreground">
                      Define who can attend this event.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-muted">
                    {getAudienceSummary()}
                  </Badge>
                </div>

                {/* Audience Mode Selector */}
                <TooltipProvider>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        value: "all" as AudienceMode,
                        label: "All Students",
                        icon: Users,
                        description:
                          "Allow all active students. Use exclusions to remove specific levels, sections, or students.",
                      },
                      {
                        value: "level_section" as AudienceMode,
                        label: "By Level / Section",
                        icon: ChevronDown,
                        description:
                          "Allow all students in the selected year levels and/or specific sections.",
                      },
                      {
                        value: "students" as AudienceMode,
                        label: "Specific Students",
                        icon: Search,
                        description:
                          "Allow only individually selected students, regardless of level or section.",
                      },
                      {
                        value: "mixed" as AudienceMode,
                        label: "Mixed Selection",
                        icon: Check,
                        description:
                          "Combine levels/sections and specific students into a single audience rule.",
                      },
                    ].map(({ value, label, icon: Icon, description }) => (
                      <Tooltip key={value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setAudienceMode(value)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                              audienceMode === value
                                ? "bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <p>{description}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>

                {/* Mode: All Students */}
                {audienceMode === "all" && (
                  <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
                    <p className="text-sm text-emerald-200">
                      <strong className="font-semibold">All active students</strong> will be allowed to attend this event.
                    </p>
                    <p className="text-xs text-emerald-300 mt-1">
                      Use exclusions below if you need to exclude specific levels, sections, or students.
                    </p>
                  </div>
                )}

                {/* Mode: By Level / Section */}
                {(audienceMode === "level_section" || audienceMode === "mixed") && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground">
                        Select levels and/or specific sections
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {isLoadingLevels ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Loading levels...
                        </div>
                      ) : levels.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No levels found. Add levels in the SIS module.
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {levels.map((level) => {
                            const levelSections = getSectionsForLevel(level.id);
                            const isExpanded = expandedLevelIds.has(level.id);
                            const isFullySelected = isLevelFullySelected(level.id);
                            const isPartiallySelected = isLevelPartiallySelected(level.id);

                            return (
                              <div key={level.id}>
                                <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted">
                                  <button
                                    type="button"
                                    onClick={() => toggleLevelExpansion(level.id)}
                                    className="p-0.5 hover:bg-accent rounded"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                                    )}
                                  </button>
                                  <Checkbox
                                    id={`level-${level.id}`}
                                    checked={isFullySelected}
                                    ref={(el) => {
                                      if (el) {
                                        (el as unknown as HTMLInputElement).indeterminate = isPartiallySelected;
                                      }
                                    }}
                                    onCheckedChange={() => toggleLevelSelection(level.id)}
                                    className="data-[state=checked]:bg-[#1B4D3E] data-[state=checked]:border-[#1B4D3E]"
                                  />
                                  <label
                                    htmlFor={`level-${level.id}`}
                                    className="flex-1 text-sm font-medium text-foreground cursor-pointer"
                                  >
                                    {level.name}
                                  </label>
                                  <span className="text-xs text-muted-foreground/70">
                                    {levelSections.length} section(s)
                                  </span>
                                </div>

                                {isExpanded && levelSections.length > 0 && (
                                  <div className="bg-muted/50 border-t border-border/50">
                                    {levelSections.map((section) => (
                                      <div
                                        key={section.id}
                                        className="flex items-center gap-2 pl-10 pr-3 py-1.5 hover:bg-accent"
                                      >
                                        <Checkbox
                                          id={`section-${section.id}`}
                                          checked={selectedSectionIds.has(section.id)}
                                          onCheckedChange={() =>
                                            toggleSectionSelection(section.id, level.id)
                                          }
                                          className="data-[state=checked]:bg-[#1B4D3E] data-[state=checked]:border-[#1B4D3E]"
                                        />
                                        <label
                                          htmlFor={`section-${section.id}`}
                                          className="text-sm text-muted-foreground cursor-pointer"
                                        >
                                          {section.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mode: Specific Students */}
                {(audienceMode === "students" || audienceMode === "mixed") && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground/70" />
                        <Input
                          type="text"
                          placeholder="Search students by name, LRN, grade, or section..."
                          value={studentSearchQuery}
                          onChange={(e) => setStudentSearchQuery(e.target.value)}
                          className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                        />
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {isLoadingStudents ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Loading students...
                        </div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {studentSearchQuery ? "No students match your search." : "No students found."}
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {filteredStudents.slice(0, 50).map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted"
                            >
                              <Checkbox
                                id={`student-${student.id}`}
                                checked={selectedStudentIds.has(student.id)}
                                onCheckedChange={() => {
                                  setSelectedStudentIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(student.id)) {
                                      next.delete(student.id);
                                    } else {
                                      next.add(student.id);
                                    }
                                    return next;
                                  });
                                }}
                                className="data-[state=checked]:bg-[#1B4D3E] data-[state=checked]:border-[#1B4D3E]"
                              />
                              <label
                                htmlFor={`student-${student.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <span className="text-sm font-medium text-foreground">
                                  {student.name}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {student.grade} - {student.section}
                                </span>
                              </label>
                              <span className="text-xs text-muted-foreground/70">{student.lrn}</span>
                            </div>
                          ))}
                          {filteredStudents.length > 50 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted">
                              Showing 50 of {filteredStudents.length} students. Use search to narrow results.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedStudentIds.size > 0 && (
                      <div className="bg-emerald-50 px-3 py-2 border-t border-emerald-100">
                        <span className="text-xs text-emerald-700 font-medium">
                          {selectedStudentIds.size} student(s) selected
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Exclusions Section */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowExclusions(!showExclusions)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    {showExclusions ? "Hide exclusions" : "Add exclusions (optional)"}
                    {(excludedLevelIds.size + excludedSectionIds.size + excludedStudentIds.size) > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                        {excludedLevelIds.size + excludedSectionIds.size + excludedStudentIds.size}
                      </Badge>
                    )}
                  </button>

                  {showExclusions && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100 space-y-3">
                      <p className="text-xs text-red-700">
                        Excluded items will not be allowed to attend, even if they match the include rules above.
                      </p>

                      {/* Exclude Levels */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-red-800">Exclude Levels</p>
                        <div className="flex flex-wrap gap-1.5">
                          {levels.map((level) => (
                            <button
                              key={level.id}
                              type="button"
                              onClick={() => {
                                setExcludedLevelIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(level.id)) {
                                    next.delete(level.id);
                                  } else {
                                    next.add(level.id);
                                  }
                                  return next;
                                });
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-xs transition-colors",
                                excludedLevelIds.has(level.id)
                                  ? "bg-red-600 text-white"
                                  : "bg-card text-muted-foreground border border-border hover:border-red-300"
                              )}
                            >
                              {level.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Exclude Sections */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-red-800">Exclude Sections</p>
                        <div className="space-y-1">
                          <Input
                            type="text"
                            placeholder="Search sections to exclude..."
                            value={excludeSectionSearch}
                            onChange={(e) => setExcludeSectionSearch(e.target.value)}
                            className="h-8 text-xs bg-card"
                          />
                          <div className="max-h-32 overflow-y-auto border border-red-100 rounded-md bg-card">
                            {sections.length === 0 ? (
                              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                No sections found.
                              </div>
                            ) : excludeFilteredSections.length === 0 && excludeSectionSearch.trim() ? (
                              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                No sections match your search.
                              </div>
                            ) : (
                              excludeFilteredSections.slice(0, 40).map((section) => {
                                const level = levels.find((l) => l.id === section.levelId);
                                const isExcluded = excludedSectionIds.has(section.id);
                                return (
                                  <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => {
                                      setExcludedSectionIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(section.id)) {
                                          next.delete(section.id);
                                        } else {
                                          next.add(section.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-left hover:bg-red-50",
                                      isExcluded && "bg-red-100 text-red-900"
                                    )}
                                  >
                                    <span className="truncate">
                                      {level?.name} - {section.name}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                        {excludedSectionIds.size > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {Array.from(excludedSectionIds).map((sId) => {
                              const section = sections.find((s) => s.id === sId);
                              const level = section ? levels.find((l) => l.id === section.levelId) : null;
                              return (
                                <Badge
                                  key={sId}
                                  variant="destructive"
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => {
                                    setExcludedSectionIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(sId);
                                      return next;
                                    });
                                  }}
                                >
                                  {level?.name} - {section?.name} ×
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Exclude Students - Quick search */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-red-800">Exclude Students</p>
                        <p className="text-[10px] text-red-600">
                          Search and click a student to exclude them.
                        </p>
                        <div className="space-y-1">
                          <Input
                            type="text"
                            placeholder="Search students to exclude..."
                            value={excludeStudentSearch}
                            onChange={(e) => setExcludeStudentSearch(e.target.value)}
                            className="h-8 text-xs bg-card"
                          />
                          <div className="max-h-32 overflow-y-auto border border-red-100 rounded-md bg-card">
                            {isLoadingStudents ? (
                              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                Loading students...
                              </div>
                            ) : allStudents.length === 0 ? (
                              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                No students found.
                              </div>
                            ) : excludeFilteredStudents.length === 0 && excludeStudentSearch.trim() ? (
                              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                No students match your search.
                              </div>
                            ) : (
                              excludeFilteredStudents.slice(0, 30).map((student) => (
                                <button
                                  key={student.id}
                                  type="button"
                                  onClick={() => {
                                    setExcludedStudentIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(student.id)) {
                                        next.delete(student.id);
                                      } else {
                                        next.add(student.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-left hover:bg-red-50",
                                    excludedStudentIds.has(student.id) && "bg-red-100 text-red-900"
                                  )}
                                >
                                  <span className="truncate">
                                    {student.name}
                                  </span>
                                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                                    {student.grade} - {student.section}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                        {excludedStudentIds.size > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(excludedStudentIds).map((sId) => {
                              const student = allStudents.find((s) => s.id === sId);
                              return (
                                <Badge
                                  key={sId}
                                  variant="destructive"
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => {
                                    setExcludedStudentIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(sId);
                                      return next;
                                    });
                                  }}
                                >
                                  {student?.name ?? sId} ×
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hidden field for audience config JSON */}
                <input
                  type="hidden"
                  name="audienceConfigJson"
                  value={JSON.stringify(buildAudienceConfig())}
                />
              </div>

              {/* Scanner Access */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Scanner Access</p>
                    <p className="text-xs text-muted-foreground">
                      Choose which users are allowed to scan attendees for this event.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-muted">
                    {selectedScannerIds.size > 0
                      ? `${selectedScannerIds.size} scanner${selectedScannerIds.size !== 1 ? "s" : ""} selected`
                      : "No scanners selected"}
                  </Badge>
                </div>

                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/60">
                  {scannerError && (
                    <div className="p-2 mb-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                      {scannerError}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
                      <Input
                        type="text"
                        placeholder="Search by name or email..."
                        value={scannerSearchQuery}
                        onChange={(e) => setScannerSearchQuery(e.target.value)}
                        className="pl-7 h-8 text-xs bg-card"
                      />
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-border rounded-md bg-card">
                    {isLoadingScanners ? (
                      <div className="px-3 py-2 text-[11px] text-muted-foreground">Loading scanners...</div>
                    ) : scannerUsers.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-muted-foreground">
                        No scanner-capable users found.
                      </div>
                    ) : filteredScanners.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-muted-foreground">
                        No users match your search.
                      </div>
                    ) : (
                      filteredScanners.slice(0, 50).map((user) => {
                        const isSelected = selectedScannerIds.has(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedScannerIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(user.id)) {
                                  next.delete(user.id);
                                } else {
                                  next.add(user.id);
                                }
                                return next;
                              });
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-left transition-colors",
                              isSelected
                                ? "bg-emerald-500/10 text-emerald-200"
                                : "hover:bg-muted/60 text-muted-foreground"
                            )}
                          >
                            <span className="truncate">
                              {user.fullName}
                              <span className="ml-1 text-[10px] text-muted-foreground">({user.email})</span>
                            </span>
                            {isSelected && (
                              <span className="ml-2 text-[10px] text-emerald-300 font-medium">Selected</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedScannerIds.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.from(selectedScannerIds).map((id) => {
                        const user = scannerUsers.find((u) => u.id === id);
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-[10px] cursor-pointer"
                            onClick={() => {
                              setSelectedScannerIds((prev) => {
                                const next = new Set(prev);
                                next.delete(id);
                                return next;
                              });
                            }}
                          >
                            {user?.fullName ?? id} ×
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <input
                  type="hidden"
                  name="scannerConfigJson"
                  value={buildScannerConfigJson()}
                />
              </div>

              {/* Date Range Picker */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Event Date</p>
                <p className="text-xs text-muted-foreground">
                  Select the date or date range for this event.
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      data-empty={!createEventRange?.from}
                      className={cn(
                        "w-full justify-start text-left font-normal px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm",
                        !createEventRange?.from && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {createEventRange?.from ? (
                        createEventRange.to ? (
                          <span>
                            {format(createEventRange.from, "MMM d, yyyy")}
                            {" – "}
                            {format(createEventRange.to, "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span>{format(createEventRange.from, "MMM d, yyyy")}</span>
                        )
                      ) : (
                        <span>Pick date or date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={createEventRange}
                      onSelect={setCreateEventRange}
                      disabled={(date) => isBefore(date, today)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Session Configuration */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Session Configuration</p>
                <p className="text-xs text-muted-foreground mb-1">
                  Define the time windows and late thresholds for each attendance session.
                  {eventDates.length > 1 && " Select a date below to configure its sessions."}
                </p>

                {eventDates.length > 1 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={useSameScheduleForAllDays}
                      onCheckedChange={(checked) => {
                        const next = Boolean(checked);
                        setUseSameScheduleForAllDays(next);

                        if (next && selectedConfigDate) {
                          setDateSessionConfigs((prev) => {
                            const base = prev.get(selectedConfigDate);
                            if (!base) return prev;
                            const nextMap = new Map<string, DateSessionConfig>();
                            for (const [dateStr] of prev.entries()) {
                              nextMap.set(dateStr, {
                                date: dateStr,
                                enabledPeriods: new Set(base.enabledPeriods),
                                sessions: base.sessions.map((s) => ({ ...s })),
                              });
                            }
                            return nextMap;
                          });
                        }
                      }}
                      className="data-[state=checked]:bg-[#1B4D3E] data-[state=checked]:border-[#1B4D3E]"
                    />
                    <span>Use the same session schedule for every day in this date range</span>
                  </label>
                )}

                {/* Date selector (only shown for multi-day events) */}
                {eventDates.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted rounded-lg border border-border/50">
                    {useSameScheduleForAllDays ? (
                      (() => {
                        const first = eventDates[0];
                        const last = eventDates[eventDates.length - 1];
                        const label =
                          format(first, "MMM d") === format(last, "MMM d")
                            ? format(first, "MMM d, yyyy")
                            : `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;

                        // Derive enabled period count from the currently selected config
                        const enabledCount = currentDateConfig?.enabledPeriods.size ?? 0;

                        return (
                          <button
                            key="combined-range"
                            type="button"
                            onClick={() => {
                              if (eventDates.length > 0) {
                                const firstDateStr = format(eventDates[0], "yyyy-MM-dd");
                                setSelectedConfigDate(firstDateStr);
                              }
                            }}
                            className="inline-flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[80px] bg-[#1B4D3E] text-white shadow-sm"
                          >
                            <span className="text-[10px] uppercase tracking-wide text-white/80">
                              {eventDates.length === 1
                                ? format(first, "EEE")
                                : `${format(first, "EEE")} – ${format(last, "EEE")}`}
                            </span>
                            <span className="font-semibold">{label}</span>
                            {enabledCount > 0 && (
                              <span className="text-[9px] mt-0.5 text-white/80">
                                {enabledCount} period{enabledCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </button>
                        );
                      })()
                    ) : (
                      eventDates.map((d) => {
                        const dateStr = format(d, "yyyy-MM-dd");
                        const isSelected = selectedConfigDate === dateStr;
                        const config = dateSessionConfigs.get(dateStr);
                        const enabledCount = config?.enabledPeriods.size ?? 0;
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => setSelectedConfigDate(dateStr)}
                            className={cn(
                              "inline-flex flex-col items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[60px]",
                              isSelected
                                ? "bg-[#1B4D3E] text-white shadow-sm"
                                : "bg-card text-muted-foreground hover:bg-accent border border-border",
                            )}
                          >
                            <span className="text-[10px] uppercase tracking-wide opacity-70">
                              {format(d, "EEE")} 
                            </span>
                            <span className="font-semibold">{format(d, "MMM d")}</span>
                            {enabledCount > 0 && (
                              <span
                                className={cn(
                                  "text-[9px] mt-0.5",
                                  isSelected ? "text-white/70" : "text-muted-foreground/70",
                                )}
                              >
                                {enabledCount} period{enabledCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* No date selected message */}
                {!currentDateConfig && eventDates.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                    Select a date range above to configure sessions.
                  </div>
                )}

                {/* Session editor for selected date */}
                {currentDateConfig && (
                  <div className="space-y-3">
                    {/* Period toggles */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { period: "morning" as SessionPeriod, label: "Morning" },
                        { period: "afternoon" as SessionPeriod, label: "Afternoon" },
                        { period: "evening" as SessionPeriod, label: "Evening" },
                      ].map(({ period, label }) => {
                        const isActive = currentDateConfig.enabledPeriods.has(period);
                        return (
                          <button
                            key={period}
                            type="button"
                            onClick={() => toggleSessionPeriod(period)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                              isActive
                                ? "bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:bg-muted",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                period === "morning"
                                  ? isActive
                                    ? "bg-amber-400"
                                    : "bg-amber-400/60"
                                  : period === "afternoon"
                                  ? isActive
                                    ? "bg-sky-400"
                                    : "bg-sky-400/60"
                                  : isActive
                                  ? "bg-indigo-400"
                                  : "bg-indigo-400/60",
                              )}
                            />
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Time conflict warnings banner */}
                    {sessionTimeWarnings.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-amber-800">
                            {sessionTimeWarnings.some((w) => w.severity === "error")
                              ? "Time conflicts detected"
                              : "Time configuration warnings"}
                          </p>
                          <p className="text-xs text-amber-700">
                            {sessionTimeWarnings.some((w) => w.severity === "error")
                              ? "Please fix the overlapping session times below before saving."
                              : "Review the highlighted times to ensure they are configured correctly."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sessions list */}
                    <div className="border border-border rounded-lg divide-y">
                      {currentDateConfig.sessions.filter((session) =>
                        currentDateConfig.enabledPeriods.has(session.period),
                      ).length === 0 && (
                        <div className="p-3 text-xs text-muted-foreground">
                          Select at least one period above to configure sessions.
                        </div>
                      )}

                      {currentDateConfig.sessions
                        .filter((session) => currentDateConfig.enabledPeriods.has(session.period))
                        .map((session) => {
                          const sessionWarnings = getWarningsForSession(session.id);
                          const hasErrors = sessionWarnings.some((w) => w.severity === "error");
                          
                          return (
                          <div key={session.id} className={cn(
                            "p-3 space-y-2",
                            hasErrors && "bg-red-50/50"
                          )}>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-foreground">{session.name}</p>
                              <div className="flex items-center gap-2">
                                {sessionWarnings.length > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className={cn(
                                        "h-3.5 w-3.5",
                                        hasErrors ? "text-red-500" : "text-amber-500"
                                      )} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <ul className="text-xs space-y-1">
                                        {sessionWarnings.map((w, i) => (
                                          <li key={i}>{w.message}</li>
                                        ))}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  {session.direction === "in" ? "Entry" : "Exit"}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-muted-foreground">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                                        Opens
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p>
                                        The earliest time a student can scan for this session and be counted. Scans
                                        before this time are not included in this session.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </label>
                                <TimePicker
                                  value={session.opens}
                                  onChange={(value) => updateSessionTime(session.id, "opens", value)}
                                  placeholder="--:--"
                                  minuteStep={5}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-muted-foreground">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                                        Late After
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p>
                                        The cut-off time for being on time. Students who scan after this time, but
                                        before "Closes", will be marked as late for this session.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </label>
                                {session.supportsLateAfter ? (
                                  <TimePicker
                                    value={session.lateAfter}
                                    onChange={(value) => updateSessionTime(session.id, "lateAfter", value)}
                                    placeholder="--:--"
                                    minuteStep={5}
                                  />
                                ) : (
                                  <div className="text-[11px] text-muted-foreground/70 border border-dashed border-border rounded-lg px-3 py-2 bg-muted/50">
                                    Not applicable for exit sessions
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-muted-foreground">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                                        Closes
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p>
                                        The last time this session accepts scans. Scans after this time will be
                                        treated as part of the next session, if there is one, or may be rejected.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </label>
                                <TimePicker
                                  value={session.closes}
                                  onChange={(value) => updateSessionTime(session.id, "closes", value)}
                                  placeholder="--:--"
                                  minuteStep={5}
                                />
                              </div>
                            </div>
                            {/* Inline warnings for this session */}
                            {sessionWarnings.length > 0 && (
                              <div className="space-y-1 pt-1">
                                {sessionWarnings.map((warning, idx) => (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "flex items-start gap-1.5 text-[11px] rounded px-2 py-1",
                                      warning.severity === "error"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-amber-100 text-amber-700"
                                    )}
                                  >
                                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span>{warning.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );})}
                    </div>
                  </div>
                )}

                <input
                  type="hidden"
                  name="sessionConfigJson"
                  value={buildSessionConfigJson()}
                />
              </div>

              {/* Venue Selection Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Select Venue</p>
                    <p className="text-xs text-muted-foreground">
                      Choose a venue for this event. Availability is based on your selected dates and sessions.
                    </p>
                  </div>
                  {venueAvailability.length > 0 && (
                    <div className="flex items-center gap-2">
                      {isCheckingAvailability && (
                        <span className="h-3 w-3 border-2 border-gray-300 border-t-[#1B4D3E] rounded-full animate-spin" />
                      )}
                      <Badge variant="outline" className="text-xs bg-muted">
                        {venueAvailabilitySummary.available} of {venueAvailabilitySummary.total} available
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Search bar */}
                {venueAvailability.length > 3 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                    <Input
                      type="text"
                      placeholder="Search venues by name or location..."
                      value={venueSearchQuery}
                      onChange={(e) => setVenueSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                )}

                {/* Loading state */}
                {isCheckingAvailability && venueAvailability.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-4 w-4 border-2 border-gray-300 border-t-[#1B4D3E] rounded-full animate-spin" />
                      <span className="text-sm">Checking venue availability...</span>
                    </div>
                  </div>
                )}

                {/* No date selected state */}
                {!createEventRange?.from && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Building2 className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-sm text-muted-foreground">Select a date to see available venues</p>
                  </div>
                )}

                {/* Venue grid */}
                {createEventRange?.from && filteredVenues.length > 0 && (
                  <TooltipProvider>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {filteredVenues.map((venue) => (
                        <VenueCard
                          key={venue.facilityId}
                          facilityId={venue.facilityId}
                          name={venue.facilityName}
                          location={venue.facilityLocation}
                          imageUrl={venue.facilityImageUrl}
                          capacity={venue.facilityCapacity}
                          status={venue.status}
                          conflicts={venue.conflicts}
                          isSelected={selectedFacilityId === venue.facilityId}
                          onSelect={() => setSelectedFacilityId(venue.facilityId)}
                          disabled={isCreatingEvent}
                        />
                      ))}
                    </div>
                  </TooltipProvider>
                )}

                {/* No venues match search */}
                {createEventRange?.from && filteredVenues.length === 0 && venueAvailability.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Search className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-muted-foreground">No venues match your search</p>
                    <button
                      type="button"
                      onClick={() => setVenueSearchQuery("")}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {/* Selected venue indicator */}
                {selectedFacilityId && (
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-800">
                      <span className="font-medium">Selected:</span>{" "}
                      {venueAvailability.find((v) => v.facilityId === selectedFacilityId)?.facilityName ?? "Unknown venue"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFacilityId("")}
                      className="ml-auto text-emerald-600 hover:text-emerald-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  className="text-sm px-4"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isCreatingEvent || isLoadingEditEvent}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreatingEvent || isLoadingEditEvent}
                >
                  {isCreatingEvent ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </span>
                  ) : (
                    isEditMode ? "Update Event" : "Save Event"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
