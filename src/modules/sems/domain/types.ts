/**
 * SEMS (School Event Management System) Domain Types
 *
 * This module defines the core types and interfaces for the SEMS events domain.
 * These types are used across all layers (domain, application, infrastructure, UI).
 *
 * @remarks
 * - All IDs are UUIDs stored as strings
 * - Dates are ISO strings (YYYY-MM-DD) for date-only values
 * - Times are HH:mm format strings
 * - Timestamps are ISO 8601 strings with timezone
 */

// ============================================================================
// Audience Configuration Types
// ============================================================================

/**
 * The kind of audience rule that determines which students are included/excluded.
 *
 * @remarks
 * - ALL_STUDENTS: Matches every active student in the system
 * - LEVEL: Matches students in specific grade levels (e.g., Grade 7, Grade 8)
 * - SECTION: Matches students in specific sections within levels
 * - STUDENT: Matches individually selected students by ID
 */
export type AudienceRuleKind = "ALL_STUDENTS" | "LEVEL" | "SECTION" | "STUDENT";

/**
 * Whether the rule includes or excludes matched students.
 *
 * @remarks
 * - include: Add matched students to the allowed set
 * - exclude: Remove matched students from the allowed set (takes precedence)
 */
export type AudienceRuleEffect = "include" | "exclude";

/**
 * Base interface for all audience rules.
 */
export interface AudienceRuleBase {
  kind: AudienceRuleKind;
  effect: AudienceRuleEffect;
}

/**
 * Rule that matches all active students in the system.
 */
export interface AllStudentsRule extends AudienceRuleBase {
  kind: "ALL_STUDENTS";
}

/**
 * Rule that matches students by their grade level.
 */
export interface LevelRule extends AudienceRuleBase {
  kind: "LEVEL";
  levelIds: string[];
}

/**
 * Rule that matches students by their section.
 */
export interface SectionRule extends AudienceRuleBase {
  kind: "SECTION";
  sectionIds: string[];
}

/**
 * Rule that matches specific individual students.
 */
export interface StudentRule extends AudienceRuleBase {
  kind: "STUDENT";
  studentIds: string[];
}

/**
 * Union type for all audience rule variants.
 */
export type AudienceRule = AllStudentsRule | LevelRule | SectionRule | StudentRule;

/**
 * Versioned configuration for event audience targeting.
 *
 * @remarks
 * Rules are evaluated in order:
 * 1. Start with an empty allowed set
 * 2. Apply all "include" rules to add matching students
 * 3. Apply all "exclude" rules to remove matching students
 *
 * Frontend stores this as JSON in a hidden form field and backend
 * persists it in events.target_audience JSONB column.
 */
export interface EventAudienceConfig {
  version: 1;
  rules: AudienceRule[];
}

// ============================================================================
// Scanner Assignment Configuration Types
// ============================================================================

/**
 * Versioned configuration describing which app users are allowed to scan attendees.
 */
export interface EventScannerConfig {
  version: 1;
  /** Ordered list of app_user IDs allowed to scan for this event */
  scannerIds: string[];
}

// ============================================================================
// Session Configuration Types
// ============================================================================

/**
 * Time period of the day for a session.
 */
export type SessionPeriod = "morning" | "afternoon" | "evening";

/**
 * Direction of the session (entry or exit).
 */
export type SessionDirection = "in" | "out";

/**
 * Configuration for a single attendance session within a day.
 *
 * @remarks
 * - opens: When scanning begins (HH:mm)
 * - lateAfter: Cut-off for on-time status; null for exit sessions
 * - closes: When scanning ends (HH:mm)
 */
export interface SessionConfig {
  id: string;
  name: string;
  period: SessionPeriod;
  direction: SessionDirection;
  opens: string;
  lateAfter: string | null;
  closes: string;
}

/**
 * Session configuration for a specific date.
 */
export interface DateSessionConfig {
  date: string; // YYYY-MM-DD
  sessions: SessionConfig[];
}

/**
 * Versioned configuration for event sessions across multiple dates.
 *
 * @remarks
 * Version 2 supports per-date session configurations, allowing different
 * time windows for each day of a multi-day event.
 */
export interface EventSessionConfig {
  version: 2;
  dates: DateSessionConfig[];
}

// ============================================================================
// Event Entity Types
// ============================================================================

/**
 * Database row representation of an event.
 *
 * @remarks
 * Maps directly to the events table columns.
 */
export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null; // Legacy single date
  start_date: string | null;
  end_date: string | null;
  facility_id: string | null;
  target_audience: EventAudienceConfig;
  session_config: EventSessionConfig;
  scanner_assignments: EventScannerConfig;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

/**
 * DTO for creating a new event.
 *
 * @remarks
 * Frontend integration:
 * - title: Required, from text input
 * - startDate/endDate: From date range picker
 * - facilityId: From venue dropdown
 * - audienceConfig: From hidden field (JSON)
 * - sessionConfig: From hidden field (JSON)
 */
export interface CreateEventDto {
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  facilityId?: string;
  audienceConfig: EventAudienceConfig;
  sessionConfig: EventSessionConfig;
  scannerConfig: EventScannerConfig;
}

/**
 * DTO for updating an existing event.
 *
 * @remarks
 * Same fields as CreateEventDto plus the event ID.
 * All fields except ID are optional - only provided fields will be updated.
 */
export interface UpdateEventDto {
  id: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  facilityId?: string | null;
  audienceConfig?: EventAudienceConfig;
  sessionConfig?: EventSessionConfig;
  scannerConfig?: EventScannerConfig;
}

/**
 * DTO for an event returned to the frontend.
 *
 * @remarks
 * Includes UI-ready data:
 * - camelCase property names
 * - Related facility data expanded
 * - Formatted display values where needed
 */
export interface EventDto {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  facility: {
    id: string;
    name: string;
    location: string;
  } | null;
  audienceConfig: EventAudienceConfig;
  sessionConfig: EventSessionConfig;
  scannerConfig: EventScannerConfig;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ============================================================================
// Event List Types
// ============================================================================

/**
 * Event status for display purposes.
 *
 * @remarks
 * - live: Event is currently happening (within session time window)
 * - scheduled: Event hasn't started yet
 * - completed: Event has ended
 */
export type EventStatus = "live" | "scheduled" | "completed";

/**
 * DTO for event list item display.
 *
 * @remarks
 * Contains all UI-ready fields for the events table:
 * - Event name, time range, venue, audience summary
 * - Attendees count (actual / expected)
 * - Status with computed logic
 */
export interface EventListItemDto {
  id: string;
  title: string;
  /** Formatted time range, e.g., "07:00 - 08:00 AM" */
  timeRange: string;
  /** Venue/facility name */
  venue: string | null;
  /** Human-readable audience summary, e.g., "All Students", "Grades 7-10" */
  audienceSummary: string;
  /** Summary of assigned scanners */
  scannerSummary: string;
  /** Number of students who have attended */
  actualAttendees: number;
  /** Expected number of students based on target audience */
  expectedAttendees: number;
  /** Computed status based on current time and session config */
  status: EventStatus;
  /** Start date for sorting/filtering */
  startDate: string;
  /** End date for sorting/filtering */
  endDate: string;
}

/**
 * Response DTO for event list with pagination.
 */
export interface EventListResponseDto {
  events: EventListItemDto[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============================================================================
// Venue Availability Types
// ============================================================================

/**
 * Request DTO for checking venue availability.
 *
 * @remarks
 * Frontend Integration:
 * - Send this after user selects dates and configures sessions
 * - `excludeEventId` should be set when editing an existing event
 *   to avoid self-conflict detection
 */
export interface VenueAvailabilityRequest {
  /** Start date of the proposed event (YYYY-MM-DD) */
  startDate: string;
  /** End date of the proposed event (YYYY-MM-DD) */
  endDate: string;
  /** Session configuration for the proposed event */
  sessions: DateSessionConfig[];
  /** Event ID to exclude from conflict check (for edit mode) */
  excludeEventId?: string;
}

/**
 * Represents a time slot conflict with an existing event.
 *
 * @remarks
 * Frontend can use this to show detailed conflict information,
 * helping users understand why a venue is unavailable.
 */
export interface SessionConflict {
  /** The date of the conflict (YYYY-MM-DD) */
  date: string;
  /** The conflicting session period (morning, afternoon, evening) */
  period: SessionPeriod;
  /** Time range of the conflict (e.g., "08:00 - 12:00") */
  timeRange: string;
  /** Title of the event causing the conflict */
  conflictingEventTitle: string;
  /** ID of the event causing the conflict */
  conflictingEventId: string;
}

/**
 * Availability status for a single venue.
 */
export type VenueAvailabilityStatus = "available" | "partial" | "unavailable";

/**
 * Result of venue availability check for a single facility.
 *
 * @remarks
 * Frontend Integration:
 * - `available`: Show with green indicator, fully selectable
 * - `partial`: Show with yellow indicator, some sessions have conflicts
 * - `unavailable`: Show with red indicator or hide, all sessions conflict
 */
export interface VenueAvailabilityResult {
  /** Facility ID */
  facilityId: string;
  /** Facility name for display */
  facilityName: string;
  /** Facility location for display */
  facilityLocation: string;
  /** Facility image URL for grid display */
  facilityImageUrl: string | null;
  /** Facility capacity */
  facilityCapacity: number | null;
  /** Overall availability status */
  status: VenueAvailabilityStatus;
  /** List of session conflicts (empty if fully available) */
  conflicts: SessionConflict[];
  /**
   * Availability breakdown by date and period.
   * Key format: "YYYY-MM-DD:period" (e.g., "2025-11-27:morning")
   */
  availabilityMap: Record<string, boolean>;
}

/**
 * Response DTO for venue availability check.
 */
export interface VenueAvailabilityResponseDto {
  /** List of venues with their availability status */
  venues: VenueAvailabilityResult[];
  /** Summary counts */
  summary: {
    total: number;
    available: number;
    partial: number;
    unavailable: number;
  };
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error detail for a specific field.
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * Result of validating input data.
 */
export interface ValidationResult<T> {
  isValid: boolean;
  errors: ValidationErrorDetail[];
  data?: T;
}
