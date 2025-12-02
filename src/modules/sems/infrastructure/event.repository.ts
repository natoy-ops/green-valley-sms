/**
 * Event Repository Implementation
 *
 * Handles all database operations for the events table using Supabase.
 *
 * @remarks
 * Single Responsibility: Only database CRUD operations, no business logic.
 * Uses the admin Supabase client for server-side operations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IEventRepository,
  CreateEventDto,
  UpdateEventDto,
  EventRow,
  EventDto,
  EventAudienceConfig,
  EventSessionConfig,
  EventScannerConfig,
  EventLifecycleStatus,
  EventVisibility,
  EventWithFacilityRow,
  StudentAudienceContext,
  ListEventsOptions,
} from "../domain";

/**
 * Maps a database row to an EventDto for API responses.
 *
 * @param row - Raw database row with joined facility
 * @returns EventDto with camelCase properties and expanded relations
 */
function mapRowToDto(row: EventWithFacilityRow): EventDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    posterImageUrl: row.poster_image_url,
    startDate: row.start_date ?? row.event_date ?? "",
    endDate: row.end_date ?? row.start_date ?? row.event_date ?? "",
    facility: row.facilities
      ? {
          id: row.facilities.id,
          name: row.facilities.name,
          location: row.facilities.location_identifier,
        }
      : null,
    audienceConfig: row.target_audience,
    sessionConfig: row.session_config,
    scannerConfig: row.scanner_assignments,
    lifecycleStatus: row.lifecycle_status,
    ownerUserId: row.owner_user_id,
    visibility: row.visibility,
    registration: {
      registrationRequired: row.registration_required,
      registrationOpensAt: row.registration_opens_at,
      registrationClosesAt: row.registration_closes_at,
      capacityLimit: row.capacity_limit,
    },
    submittedForApprovalAt: row.submitted_for_approval_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    approvalComment: row.approval_comment,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionComment: row.rejection_comment,
    publishedAt: row.published_at,
    completedAt: row.completed_at,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type StudentGuardianRow = {
  student_id: string;
  students: {
    section_id: string | null;
    sections: {
      level_id: string | null;
    } | null;
  } | null;
};

type RawStudentGuardianRow = {
  student_id: string;
  students: Array<{
    section_id: string | null;
    sections: Array<{ level_id: string | null }>;
  }>;
};

/**
 * Supabase implementation of the Event repository.
 *
 * @remarks
 * Dependency Injection: Receives SupabaseClient via constructor.
 * This allows for easy testing with mock clients.
 */
export class EventRepository implements IEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Create a new event in the database.
   *
   * @param dto - Event creation data
   * @param createdBy - UUID of the user creating the event
   * @returns The created event row
   * @throws Error if database insert fails
   */
  async create(dto: CreateEventDto, createdBy: string): Promise<EventRow> {
    const insertPayload = {
      title: dto.title,
      description: dto.description ?? null,
      poster_image_url: dto.posterImageUrl ?? null,
      start_date: dto.startDate,
      end_date: dto.endDate,
      facility_id: dto.facilityId ?? null,
      target_audience: dto.audienceConfig,
      session_config: dto.sessionConfig,
      scanner_assignments: dto.scannerConfig,
      visibility: dto.visibility,
      registration_required: dto.registrationRequired,
      registration_opens_at: dto.registrationOpensAt ?? null,
      registration_closes_at: dto.registrationClosesAt ?? null,
      capacity_limit: dto.capacityLimit ?? null,
      owner_user_id: dto.ownerUserId ?? createdBy,
      lifecycle_status: dto.lifecycleStatus ?? "draft",
      submitted_for_approval_at: dto.submittedForApprovalAt ?? null,
      approved_by: dto.approvedBy ?? null,
      approved_at: dto.approvedAt ?? null,
      approval_comment: dto.approvalComment ?? null,
      rejected_by: dto.rejectedBy ?? null,
      rejected_at: dto.rejectedAt ?? null,
      rejection_comment: dto.rejectionComment ?? null,
      published_at: dto.publishedAt ?? null,
      completed_at: dto.completedAt ?? null,
      cancelled_by: dto.cancelledBy ?? null,
      cancelled_at: dto.cancelledAt ?? null,
      cancellation_reason: dto.cancellationReason ?? null,
      created_by: createdBy,
    };

    const { data, error } = await this.supabase
      .from("events")
      .insert(insertPayload)
      .select(
        `
        id,
        title,
        description,
        poster_image_url,
        event_date,
        start_date,
        end_date,
        facility_id,
        target_audience,
        session_config,
        scanner_assignments,
        visibility,
        registration_required,
        registration_opens_at,
        registration_closes_at,
        capacity_limit,
        owner_user_id,
        lifecycle_status,
        submitted_for_approval_at,
        approved_by,
        approved_at,
        approval_comment,
        rejected_by,
        rejected_at,
        rejection_comment,
        published_at,
        completed_at,
        cancelled_by,
        cancelled_at,
        cancellation_reason,
        created_by,
        created_at,
        updated_by,
        updated_at
      `
      )
      .single<EventRow>();

    if (error) {
      console.error("[EventRepository.create] Database error:", error);
      throw new Error(`Failed to create event: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create event: No data returned");
    }

    return data;
  }

  /**
   * Update an existing event in the database.
   *
   * @param dto - Event update data (only provided fields will be updated)
   * @param updatedBy - UUID of the user updating the event
   * @returns The updated event row
   * @throws Error if database update fails or event not found
   */
  async update(dto: UpdateEventDto, updatedBy: string): Promise<EventRow> {
    // Build update payload with only provided fields
    const updatePayload: Record<string, unknown> = {
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) {
      updatePayload.title = dto.title;
    }
    if (dto.description !== undefined) {
      updatePayload.description = dto.description;
    }
    if (dto.posterImageUrl !== undefined) {
      updatePayload.poster_image_url = dto.posterImageUrl;
    }
    if (dto.startDate !== undefined) {
      updatePayload.start_date = dto.startDate;
    }
    if (dto.endDate !== undefined) {
      updatePayload.end_date = dto.endDate;
    }
    if (dto.facilityId !== undefined) {
      updatePayload.facility_id = dto.facilityId;
    }
    if (dto.audienceConfig !== undefined) {
      updatePayload.target_audience = dto.audienceConfig;
    }
    if (dto.sessionConfig !== undefined) {
      updatePayload.session_config = dto.sessionConfig;
    }
    if (dto.scannerConfig !== undefined) {
      updatePayload.scanner_assignments = dto.scannerConfig;
    }
    if (dto.visibility !== undefined) {
      updatePayload.visibility = dto.visibility;
    }
    if (dto.registrationRequired !== undefined) {
      updatePayload.registration_required = dto.registrationRequired;
    }
    if (dto.registrationOpensAt !== undefined) {
      updatePayload.registration_opens_at = dto.registrationOpensAt ?? null;
    }
    if (dto.registrationClosesAt !== undefined) {
      updatePayload.registration_closes_at = dto.registrationClosesAt ?? null;
    }
    if (dto.capacityLimit !== undefined) {
      updatePayload.capacity_limit = dto.capacityLimit ?? null;
    }
    if (dto.ownerUserId !== undefined) {
      updatePayload.owner_user_id = dto.ownerUserId;
    }
    if (dto.lifecycleStatus !== undefined) {
      updatePayload.lifecycle_status = dto.lifecycleStatus;
    }
    if (dto.submittedForApprovalAt !== undefined) {
      updatePayload.submitted_for_approval_at = dto.submittedForApprovalAt;
    }
    if (dto.approvedBy !== undefined) {
      updatePayload.approved_by = dto.approvedBy;
    }
    if (dto.approvedAt !== undefined) {
      updatePayload.approved_at = dto.approvedAt;
    }
    if (dto.approvalComment !== undefined) {
      updatePayload.approval_comment = dto.approvalComment;
    }
    if (dto.rejectedBy !== undefined) {
      updatePayload.rejected_by = dto.rejectedBy;
    }
    if (dto.rejectedAt !== undefined) {
      updatePayload.rejected_at = dto.rejectedAt;
    }
    if (dto.rejectionComment !== undefined) {
      updatePayload.rejection_comment = dto.rejectionComment;
    }
    if (dto.publishedAt !== undefined) {
      updatePayload.published_at = dto.publishedAt;
    }
    if (dto.completedAt !== undefined) {
      updatePayload.completed_at = dto.completedAt;
    }
    if (dto.cancelledBy !== undefined) {
      updatePayload.cancelled_by = dto.cancelledBy;
    }
    if (dto.cancelledAt !== undefined) {
      updatePayload.cancelled_at = dto.cancelledAt;
    }
    if (dto.cancellationReason !== undefined) {
      updatePayload.cancellation_reason = dto.cancellationReason;
    }

    const { data, error } = await this.supabase
      .from("events")
      .update(updatePayload)
      .eq("id", dto.id)
      .select(
        `
        id,
        title,
        description,
        poster_image_url,
        event_date,
        start_date,
        end_date,
        facility_id,
        target_audience,
        session_config,
        scanner_assignments,
        visibility,
        registration_required,
        registration_opens_at,
        registration_closes_at,
        capacity_limit,
        owner_user_id,
        lifecycle_status,
        submitted_for_approval_at,
        approved_by,
        approved_at,
        approval_comment,
        rejected_by,
        rejected_at,
        rejection_comment,
        published_at,
        completed_at,
        cancelled_by,
        cancelled_at,
        cancellation_reason,
        created_by,
        created_at,
        updated_by,
        updated_at
      `
      )
      .single<EventRow>();

    if (error) {
      console.error("[EventRepository.update] Database error:", error);
      throw new Error(`Failed to update event: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to update event: No data returned");
    }

    return data;
  }

  /**
   * Find an event by its ID.
   *
   * @param id - UUID of the event
   * @returns The event row or null if not found
   */
  async findById(id: string): Promise<EventRow | null> {
    const { data, error } = await this.supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        poster_image_url,
        event_date,
        start_date,
        end_date,
        facility_id,
        target_audience,
        session_config,
        scanner_assignments,
        visibility,
        registration_required,
        registration_opens_at,
        registration_closes_at,
        capacity_limit,
        owner_user_id,
        lifecycle_status,
        submitted_for_approval_at,
        approved_by,
        approved_at,
        approval_comment,
        rejected_by,
        rejected_at,
        rejection_comment,
        published_at,
        completed_at,
        cancelled_by,
        cancelled_at,
        cancellation_reason,
        created_by,
        created_at,
        updated_by,
        updated_at
      `
      )
      .eq("id", id)
      .single<EventRow>();

    if (error) {
      // PGRST116 is "no rows returned" - not an error for findById
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("[EventRepository.findById] Database error:", error);
      throw new Error(`Failed to find event: ${error.message}`);
    }

    return data;
  }

  /**
   * Find an event by ID with related facility data.
   *
   * @param id - UUID of the event
   * @returns The event DTO with expanded relations or null
   */
  async findByIdWithFacility(id: string): Promise<EventDto | null> {
    const { data, error } = await this.supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        poster_image_url,
        event_date,
        start_date,
        end_date,
        facility_id,
        target_audience,
        session_config,
        scanner_assignments,
        visibility,
        registration_required,
        registration_opens_at,
        registration_closes_at,
        capacity_limit,
        owner_user_id,
        lifecycle_status,
        submitted_for_approval_at,
        approved_by,
        approved_at,
        approval_comment,
        rejected_by,
        rejected_at,
        rejection_comment,
        published_at,
        completed_at,
        cancelled_by,
        cancelled_at,
        cancellation_reason,
        created_by,
        created_at,
        updated_by,
        updated_at,
        facilities (
          id,
          name,
          location_identifier
        )
      `
      )
      .eq("id", id)
      .single<EventWithFacilityRow>();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("[EventRepository.findByIdWithFacility] Database error:", error);
      throw new Error(`Failed to find event: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapRowToDto(data);
  }

  /**
   * Check if a facility exists and is operational.
   *
   * @param facilityId - UUID of the facility
   * @returns True if facility exists and is operational
   */
  async facilityExists(facilityId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("facilities")
      .select("id")
      .eq("id", facilityId)
      .eq("status", "operational")
      .single();

    if (error) {
      // No rows returned means facility doesn't exist or isn't operational
      if (error.code === "PGRST116") {
        return false;
      }
      console.error("[EventRepository.facilityExists] Database error:", error);
      return false;
    }
    return !!data;
  }

  /**
   * Find all events with facility data, ordered by start date descending.
   *
   * @param options - Query options (pagination, filters)
   * @returns Array of events with facility data
   */
  async findAll(options?: ListEventsOptions): Promise<{ events: EventWithFacilityRow[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        poster_image_url,
        event_date,
        start_date,
        end_date,
        facility_id,
        target_audience,
        session_config,
        scanner_assignments,
        lifecycle_status,
        owner_user_id,
        visibility,
        registration_required,
        registration_opens_at,
        registration_closes_at,
        capacity_limit,
        submitted_for_approval_at,
        approved_by,
        approved_at,
        approval_comment,
        rejected_by,
        rejected_at,
        rejection_comment,
        published_at,
        completed_at,
        cancelled_by,
        cancelled_at,
        cancellation_reason,
        created_by,
        created_at,
        updated_by,
        updated_at,
        facilities (
          id,
          name,
          location_identifier
        )
      `,
        { count: "exact" }
      )
      .order("start_date", { ascending: false, nullsFirst: false });

    if (!options?.disablePagination) {
      query = query.range(offset, offset + pageSize - 1);
    }

    // Apply filters
    if (options?.facilityId) {
      query = query.eq("facility_id", options.facilityId);
    }

    if (options?.searchTerm) {
      query = query.ilike("title", `%${options.searchTerm}%`);
    }

    const ownerOrInternalForUserId = options?.ownerOrInternalForUserId;

    if (options?.ownerUserId && !ownerOrInternalForUserId) {
      query = query.eq("owner_user_id", options.ownerUserId);
    }

    if (ownerOrInternalForUserId) {
      const orFilter = [`owner_user_id.eq.${ownerOrInternalForUserId}`, "visibility.eq.internal"].join(",");
      query = query.or(orFilter);
    }

    if (options?.lifecycleStatuses && options.lifecycleStatuses.length > 0) {
      query = query.in("lifecycle_status", options.lifecycleStatuses);
    }

    if (options?.excludeLifecycleStatuses && options.excludeLifecycleStatuses.length > 0) {
      const excluded = options.excludeLifecycleStatuses.join(",");
      query = query.not("lifecycle_status", "in", `(${excluded})`);
    }

    if (options?.visibilities && options.visibilities.length > 0) {
      query = query.in("visibility", options.visibilities);
    }
    const { data, error, count } = await query;

    if (error) {
      console.error("[EventRepository.findAll] Database error:", error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    // Supabase returns facilities as object (not array) for single FK join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (data ?? []).map((row: any) => ({
      ...row,
      facilities: row.facilities ?? null,
    })) as EventWithFacilityRow[];

    return {
      events,
      total: count ?? 0,
    };
  }

  /**
   * Find all events where a specific scanner is assigned.
   *
   * @param scannerId - App user ID of the scanner
   * @param options - Query options (pagination, filters)
   * @returns Array of events with facility data for this scanner
   */
  async findAllForScanner(
    scannerId: string,
    options?: {
      page?: number;
      pageSize?: number;
      facilityId?: string;
      searchTerm?: string;
    }
  ): Promise<{ events: EventWithFacilityRow[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        poster_image_url,
        event_date,
        start_date,
        end_date,
        facility_id,
        target_audience,
        session_config,
        scanner_assignments,
        lifecycle_status,
        owner_user_id,
        visibility,
        registration_required,
        registration_opens_at,
        registration_closes_at,
        capacity_limit,
        submitted_for_approval_at,
        approved_by,
        approved_at,
        approval_comment,
        rejected_by,
        rejected_at,
        rejection_comment,
        published_at,
        completed_at,
        cancelled_by,
        cancelled_at,
        cancellation_reason,
        created_by,
        created_at,
        updated_by,
        updated_at,
        facilities (
          id,
          name,
          location_identifier
        )
      `,
        { count: "exact" }
      )
      .order("start_date", { ascending: false, nullsFirst: false })
      .eq("lifecycle_status", "published")
      .range(offset, offset + pageSize - 1)
      .contains("scanner_assignments", { scannerIds: [scannerId] });

    if (options?.facilityId) {
      query = query.eq("facility_id", options.facilityId);
    }

    if (options?.searchTerm) {
      query = query.ilike("title", `%${options.searchTerm}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[EventRepository.findAllForScanner] Database error:", error);
      throw new Error(`Failed to fetch scanner events: ${error.message}`);
    }

    // Supabase returns facilities as object (not array) for single FK join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scannerEvents = (data ?? []).map((row: any) => ({
      ...row,
      facilities: row.facilities ?? null,
    })) as EventWithFacilityRow[];

    return {
      events: scannerEvents,
      total: count ?? 0,
    };
  }

  async countActiveStudents(): Promise<number> {
    const { count, error } = await this.supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (error) {
      console.error("[EventRepository.countActiveStudents] Error:", error);
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Count students by level IDs.
   *
   * @param levelIds - Array of level UUIDs
   * @returns Count of active students in those levels
   */
  async countStudentsByLevels(levelIds: string[]): Promise<number> {
    if (levelIds.length === 0) return 0;

    // Get sections for these levels first
    const { data: sections, error: sectionsError } = await this.supabase
      .from("sections")
      .select("id")
      .in("level_id", levelIds);

    if (sectionsError || !sections) {
      console.error("[EventRepository.countStudentsByLevels] Error:", sectionsError);
      return 0;
    }

    const sectionIds = sections.map((s) => s.id);
    if (sectionIds.length === 0) return 0;

    const { count, error } = await this.supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("section_id", sectionIds)
      .eq("is_active", true);

    if (error) {
      console.error("[EventRepository.countStudentsByLevels] Error:", error);
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Count students by section IDs.
   *
   * @param sectionIds - Array of section UUIDs
   * @returns Count of active students in those sections
   */
  async countStudentsBySections(sectionIds: string[]): Promise<number> {
    if (sectionIds.length === 0) return 0;

    const { count, error } = await this.supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("section_id", sectionIds)
      .eq("is_active", true);

    if (error) {
      console.error("[EventRepository.countStudentsBySections] Error:", error);
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Get level names by their IDs.
   *
   * @param levelIds - Array of level UUIDs
   * @returns Map of level ID to level name
   */
  async getLevelNames(levelIds: string[]): Promise<Map<string, string>> {
    if (levelIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from("levels")
      .select("id, name")
      .in("id", levelIds);

    if (error || !data) {
      console.error("[EventRepository.getLevelNames] Error:", error);
      return new Map();
    }

    return new Map(data.map((l) => [l.id, l.name]));
  }

  /**
   * Find events that use specific facilities within a date range.
   *
   * @param startDate - Start of date range (YYYY-MM-DD)
   * @param endDate - End of date range (YYYY-MM-DD)
   * @param excludeEventId - Optional event ID to exclude (for edit mode)
   * @returns Array of events with their facility and session config
   *
   * @remarks
   * Used for venue availability checking. Returns events where:
   * - facility_id is not null
   * - date range overlaps with the requested range
   * - optionally excludes a specific event (when editing)
   */
  async findEventsInDateRange(
    startDate: string,
    endDate: string,
    excludeEventId?: string
  ): Promise<
    Array<{
      id: string;
      title: string;
      facilityId: string;
      startDate: string;
      endDate: string;
      sessionConfig: EventSessionConfig;
    }>
  > {
    // Query events that:
    // 1. Have a facility assigned
    // 2. Overlap with the requested date range
    let query = this.supabase
      .from("events")
      .select(
        `
        id,
        title,
        facility_id,
        start_date,
        end_date,
        event_date,
        session_config
      `
      )
      .not("facility_id", "is", null)
      // Date range overlap: event.start <= request.end AND event.end >= request.start
      .or(`start_date.lte.${endDate},event_date.lte.${endDate}`)
      .or(`end_date.gte.${startDate},start_date.gte.${startDate},event_date.gte.${startDate}`);

    // Exclude specific event if provided (for edit mode)
    if (excludeEventId) {
      query = query.neq("id", excludeEventId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[EventRepository.findEventsInDateRange] Database error:", error);
      throw new Error(`Failed to find events: ${error.message}`);
    }

    // Map to cleaner format and filter to only those with actual date overlap
    return (data ?? [])
      .filter((row) => {
        // Calculate effective dates
        const eventStart = row.start_date ?? row.event_date;
        const eventEnd = row.end_date ?? row.start_date ?? row.event_date;
        if (!eventStart || !eventEnd) return false;

        // Check actual date overlap
        return eventStart <= endDate && eventEnd >= startDate;
      })
      .map((row) => ({
        id: row.id,
        title: row.title,
        facilityId: row.facility_id as string,
        startDate: row.start_date ?? row.event_date ?? "",
        endDate: row.end_date ?? row.start_date ?? row.event_date ?? "",
        sessionConfig: row.session_config as EventSessionConfig,
      }));
  }

  /**
   * Get all operational facilities with their details.
   *
   * @returns Array of operational facilities
   */
  async getOperationalFacilities(): Promise<
    Array<{
      id: string;
      name: string;
      location: string;
      imageUrl: string | null;
      capacity: number | null;
    }>
  > {
    const { data, error } = await this.supabase
      .from("facilities")
      .select("id, name, location_identifier, image_url, capacity")
      .eq("status", "operational")
      .order("name", { ascending: true });

    if (error) {
      console.error("[EventRepository.getOperationalFacilities] Database error:", error);
      throw new Error(`Failed to fetch facilities: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location_identifier,
      imageUrl: row.image_url,
      capacity: row.capacity,
    }));
  }

  /**
   * Count actual attendees for an event from attendance_logs.
   *
   * @param eventId - UUID of the event
   * @returns Count of unique students who have scanned
   *
   * @remarks
   * Joins event_sessions to get all sessions for the event,
   * then counts unique student_id in attendance_logs.
   */
  async countEventAttendees(eventId: string): Promise<number> {
    // First get all event_session IDs for this event
    const { data: sessions, error: sessionsError } = await this.supabase
      .from("event_sessions")
      .select("id")
      .eq("event_id", eventId);

    if (sessionsError) {
      console.error("[EventRepository.countEventAttendees] Sessions error:", sessionsError);
      return 0;
    }

    if (!sessions || sessions.length === 0) {
      // No event_sessions created yet - return 0
      return 0;
    }

    const sessionIds = sessions.map((s) => s.id);

    // Count unique students across all sessions
    // We need to fetch all student_ids and count distinct ones since Supabase
    // doesn't support COUNT(DISTINCT column) directly via the JS client
    const { data: logs, error } = await this.supabase
      .from("attendance_logs")
      .select("student_id")
      .in("event_session_id", sessionIds);

    if (error) {
      console.error("[EventRepository.countEventAttendees] Count error:", error);
      return 0;
    }

    if (!logs || logs.length === 0) {
      return 0;
    }

    // Count unique student IDs
    const uniqueStudentIds = new Set(logs.map((log) => log.student_id));
    return uniqueStudentIds.size;
  }

  async getStudentContextsForUser(appUserId: string): Promise<StudentAudienceContext[]> {
    if (!appUserId) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("student_guardians")
      .select(
        `student_id, students:student_id ( section_id, sections:section_id ( level_id ) )`
      )
      .eq("app_user_id", appUserId);

    if (error || !data) {
      console.error("[EventRepository.getStudentContextsForUser] Error:", error);
      return [];
    }

    const rawRows = data as RawStudentGuardianRow[];

    return rawRows
      .map(({ student_id, students }) => {
        const student = students?.[0] ?? null;
        const section = student?.sections?.[0] ?? null;
        const normalized: StudentGuardianRow = {
          student_id,
          students: student
            ? {
                section_id: student.section_id,
                sections: section ?? null,
              }
            : null,
        };

        return {
          studentId: normalized.student_id,
          sectionId: normalized.students?.section_id ?? null,
          levelId: normalized.students?.sections?.level_id ?? null,
        };
      })
      .filter((context) => Boolean(context.studentId));
  }

  /**
   * Delete multiple events by their IDs.
   *
   * @param ids - Array of event UUIDs to delete
   * @returns The number of rows deleted
   */
  async deleteManyByIds(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;

    const { error, count } = await this.supabase
      .from("events")
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) {
      console.error("[EventRepository.deleteManyByIds] Database error:", error);
      throw new Error(`Failed to delete events: ${error.message}`);
    }

    return count ?? 0;
  }
}
