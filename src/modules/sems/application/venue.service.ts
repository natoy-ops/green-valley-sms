/**
 * Venue Availability Service
 *
 * Handles venue availability checking with session-based conflict detection.
 *
 * @remarks
 * Single Responsibility: Only handles venue availability logic.
 * Dependency Inversion: Depends on repository abstraction.
 *
 * Frontend Integration:
 * - Call this service before displaying venue selection
 * - Pass the user's selected dates and configured sessions
 * - Results include availability status and conflict details
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VenueAvailabilityRequest,
  VenueAvailabilityResult,
  VenueAvailabilityResponseDto,
  VenueAvailabilityStatus,
  SessionConflict,
  DateSessionConfig,
  SessionConfig,
  SessionPeriod,
  EventSessionConfig,
} from "../domain";
import { EventRepository } from "../infrastructure";

/**
 * Represents an existing event that might conflict with requested sessions.
 */
interface ExistingEventInfo {
  id: string;
  title: string;
  facilityId: string;
  startDate: string;
  endDate: string;
  sessionConfig: EventSessionConfig;
}

/**
 * Service for checking venue availability based on session overlaps.
 *
 * @remarks
 * Key Algorithm:
 * Two sessions conflict if they're on the same date AND have overlapping time windows.
 * Time overlap: sessionA.opens < sessionB.closes AND sessionA.closes > sessionB.opens
 */
export class VenueService {
  private readonly eventRepository: EventRepository;

  constructor(supabase: SupabaseClient) {
    this.eventRepository = new EventRepository(supabase);
  }

  /**
   * Check venue availability for the requested dates and sessions.
   *
   * @param request - Availability check request with dates and sessions
   * @returns Response with venue availability results and summary
   *
   * @remarks
   * Frontend Integration:
   * - Call when user changes dates or session configuration
   * - Results can be used to show/hide venues or display conflict details
   * - `excludeEventId` should be set when editing an existing event
   *
   * @example
   * ```ts
   * const result = await venueService.checkAvailability({
   *   startDate: "2025-11-27",
   *   endDate: "2025-11-28",
   *   sessions: [
   *     {
   *       date: "2025-11-27",
   *       sessions: [{ id: "morning-in", period: "morning", opens: "08:00", closes: "12:00", ... }]
   *     }
   *   ],
   *   excludeEventId: "uuid-of-event-being-edited" // optional
   * });
   * ```
   */
  async checkAvailability(
    request: VenueAvailabilityRequest
  ): Promise<VenueAvailabilityResponseDto> {
    const { startDate, endDate, sessions, excludeEventId } = request;

    // Step 1: Get all operational facilities
    const facilities = await this.eventRepository.getOperationalFacilities();

    // Step 2: Get all events in the date range (excluding current event if editing)
    const existingEvents = await this.eventRepository.findEventsInDateRange(
      startDate,
      endDate,
      excludeEventId
    );

    // Step 3: Check each facility's availability
    const venues: VenueAvailabilityResult[] = facilities.map((facility) => {
      // Filter events that use this facility
      const facilityEvents = existingEvents.filter(
        (e) => e.facilityId === facility.id
      );

      // Check for conflicts
      const { conflicts, availabilityMap } = this.checkFacilityConflicts(
        sessions,
        facilityEvents
      );

      // Determine overall status
      const status = this.determineStatus(sessions, conflicts, availabilityMap);

      return {
        facilityId: facility.id,
        facilityName: facility.name,
        facilityLocation: facility.location,
        facilityImageUrl: facility.imageUrl,
        facilityCapacity: facility.capacity,
        status,
        conflicts,
        availabilityMap,
      };
    });

    // Step 4: Calculate summary
    const summary = {
      total: venues.length,
      available: venues.filter((v) => v.status === "available").length,
      partial: venues.filter((v) => v.status === "partial").length,
      unavailable: venues.filter((v) => v.status === "unavailable").length,
    };

    return { venues, summary };
  }

  /**
   * Check a single facility for session conflicts.
   *
   * @param requestedSessions - Sessions the user wants to book
   * @param existingEvents - Events already using this facility
   * @returns Conflicts and availability map
   */
  private checkFacilityConflicts(
    requestedSessions: DateSessionConfig[],
    existingEvents: ExistingEventInfo[]
  ): {
    conflicts: SessionConflict[];
    availabilityMap: Record<string, boolean>;
  } {
    const conflicts: SessionConflict[] = [];
    const availabilityMap: Record<string, boolean> = {};

    // Initialize all requested slots as available
    for (const dateConfig of requestedSessions) {
      for (const session of dateConfig.sessions) {
        const key = `${dateConfig.date}:${session.period}`;
        availabilityMap[key] = true;
      }
    }

    // Check each requested session against existing events
    for (const dateConfig of requestedSessions) {
      const requestDate = dateConfig.date;

      for (const requestedSession of dateConfig.sessions) {
        // Check against each existing event
        for (const existingEvent of existingEvents) {
          // Skip if event doesn't cover this date
          if (requestDate < existingEvent.startDate || requestDate > existingEvent.endDate) {
            continue;
          }

          // Find existing sessions on this date
          const existingDateConfig = existingEvent.sessionConfig?.dates?.find(
            (d) => d.date === requestDate
          );

          if (!existingDateConfig?.sessions) {
            continue;
          }

          // Check for overlapping sessions
          for (const existingSession of existingDateConfig.sessions) {
            if (this.sessionsOverlap(requestedSession, existingSession)) {
              const key = `${requestDate}:${requestedSession.period}`;
              availabilityMap[key] = false;

              // Add conflict detail
              conflicts.push({
                date: requestDate,
                period: requestedSession.period,
                timeRange: `${existingSession.opens} - ${existingSession.closes}`,
                conflictingEventTitle: existingEvent.title,
                conflictingEventId: existingEvent.id,
              });
            }
          }
        }
      }
    }

    return { conflicts, availabilityMap };
  }

  /**
   * Check if two sessions have overlapping time windows.
   *
   * @param sessionA - First session
   * @param sessionB - Second session
   * @returns True if sessions overlap in time
   *
   * @remarks
   * Overlap condition: A.opens < B.closes AND A.closes > B.opens
   * This handles all overlap cases:
   * - A starts before B ends AND A ends after B starts
   * - Fully contained, partial overlap, etc.
   */
  private sessionsOverlap(sessionA: SessionConfig, sessionB: SessionConfig): boolean {
    // Convert HH:mm to comparable numbers
    const aOpens = this.timeToMinutes(sessionA.opens);
    const aCloses = this.timeToMinutes(sessionA.closes);
    const bOpens = this.timeToMinutes(sessionB.opens);
    const bCloses = this.timeToMinutes(sessionB.closes);

    // Handle edge case where close time might be next day (e.g., 23:00 - 01:00)
    // For now, assume same-day sessions only
    return aOpens < bCloses && aCloses > bOpens;
  }

  /**
   * Convert HH:mm time string to minutes since midnight.
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Determine the overall availability status for a facility.
   *
   * @param requestedSessions - All requested sessions
   * @param conflicts - Detected conflicts
   * @param availabilityMap - Per-slot availability
   * @returns Overall status
   */
  private determineStatus(
    requestedSessions: DateSessionConfig[],
    conflicts: SessionConflict[],
    availabilityMap: Record<string, boolean>
  ): VenueAvailabilityStatus {
    if (conflicts.length === 0) {
      return "available";
    }

    // Count total requested slots
    let totalSlots = 0;
    for (const dateConfig of requestedSessions) {
      totalSlots += dateConfig.sessions.length;
    }

    // Count unavailable slots
    const unavailableSlots = Object.values(availabilityMap).filter((v) => !v).length;

    // If all slots are unavailable, venue is fully unavailable
    if (unavailableSlots >= totalSlots) {
      return "unavailable";
    }

    // Some slots available, some not
    return "partial";
  }

  /**
   * Get availability summary for a specific date and period.
   *
   * @param facilityId - Facility to check
   * @param date - Date to check (YYYY-MM-DD)
   * @param period - Session period (morning, afternoon, evening)
   * @param excludeEventId - Optional event to exclude
   * @returns Whether the slot is available
   */
  async isSlotAvailable(
    facilityId: string,
    date: string,
    period: SessionPeriod,
    excludeEventId?: string
  ): Promise<boolean> {
    const existingEvents = await this.eventRepository.findEventsInDateRange(
      date,
      date,
      excludeEventId
    );

    const facilityEvents = existingEvents.filter((e) => e.facilityId === facilityId);

    for (const event of facilityEvents) {
      const dateConfig = event.sessionConfig?.dates?.find((d) => d.date === date);
      if (dateConfig?.sessions?.some((s) => s.period === period)) {
        return false;
      }
    }

    return true;
  }
}
