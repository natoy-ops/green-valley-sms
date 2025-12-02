/**
 * Event Service Implementation
 *
 * Handles business logic, validation, and orchestration for event operations.
 *
 * @remarks
 * - Validates all input before persistence
 * - Enforces business rules
 * - Coordinates with repository for data access
 * - Returns DTOs ready for API responses
 */

import { ADMIN_ROLES } from "@/config/roles";
import type { UserRole } from "@/core/auth/types";
import type {
  IEventService,
  IEventRepository,
  CreateEventDto,
  UpdateEventDto,
  EventDto,
  ValidationResult,
  ValidationErrorDetail,
  EventAudienceConfig,
  EventSessionConfig,
  AudienceRule,
  EventListItemDto,
  EventListResponseDto,
  EventStatus,
  ListEventsOptions,
  LevelRule,
  SectionRule,
  StudentRule,
  EventScannerConfig,
  WorkflowActorContext,
  EventLifecycleStatus,
  EventWorkflowAction,
  EventVisibility,
  EventRegistrationMetadata,
  EventRow,
  EventWithFacilityRow,
} from "../domain";

/**
 * Custom error for validation failures.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: ValidationErrorDetail[]
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

/**
 * Custom error for not found resources.
 */
export class NotFoundError extends Error {
  constructor(
    message: string,
    public readonly resource: string,
    public readonly id: string
  ) {
    super(message);
    this.name = "NotFoundError";
  }
}

interface StudentAudienceContext {
  studentId: string;
  sectionId: string | null;
  levelId: string | null;
}

const ALLOWED_VISIBILITY_VALUES: readonly EventVisibility[] = [
  "internal",
  "student",
  "public",
];

const ORGANIZER_ROLE_SET = new Set<UserRole>(["TEACHER", "STAFF"]);

const CRITICAL_FIELDS: ReadonlyArray<keyof UpdateEventDto> = [
  "startDate",
  "endDate",
  "sessionConfig",
  "audienceConfig",
  "facilityId",
  "capacityLimit",
  "registrationRequired",
  "registrationOpensAt",
  "registrationClosesAt",
];

/**
 * Event service implementation.
 *
 * @remarks
 * Dependency Injection: Receives repository via constructor.
 */
export class EventService implements IEventService {
  constructor(private readonly eventRepository: IEventRepository) {}

  /**
   * List events with computed display fields.
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of events with UI-ready data
   *
   * @remarks
   * Computes for each event:
   * - Time range from session_config
   * - Audience summary from target_audience
   * - Expected attendees based on audience rules
   * - Actual attendees from attendance_logs
   * - Status (live, scheduled, completed)
   */
  async listEvents(options?: ListEventsOptions): Promise<EventListResponseDto> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    const { events: rawEvents, total } = await this.eventRepository.findAll({
      ...options,
      page,
      pageSize,
    });

    return this.buildPaginatedListResponse(rawEvents, page, pageSize, total);
  }

  async listScannerEvents(
    scannerId: string,
    options?: ListEventsOptions
  ): Promise<EventListResponseDto> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    const { events: rawEvents, total } = await this.eventRepository.findAllForScanner(scannerId, {
      page,
      pageSize,
      facilityId: options?.facilityId,
      searchTerm: options?.searchTerm,
    });

    return this.buildPaginatedListResponse(rawEvents, page, pageSize, total);
  }

  async listOrganizerEvents(
    actor: WorkflowActorContext,
    options?: ListEventsOptions
  ): Promise<EventListResponseDto> {
    if (!this.isAdmin(actor) && !this.isOrganizer(actor)) {
      throw new BusinessRuleError("You do not have permission to view organizer events.");
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const baseOptions: ListEventsOptions = {
      ...options,
      page,
      pageSize,
    };

    if (this.isAdmin(actor)) {
      const { events: rawEvents, total } = await this.eventRepository.findAll({
        ...baseOptions,
        ownerUserId: options?.ownerUserId,
      });
      return this.buildPaginatedListResponse(rawEvents, page, pageSize, total);
    }

    const { events: rawEvents, total } = await this.eventRepository.findAll({
      ...baseOptions,
      ownerOrInternalForUserId: actor.userId,
    });

    return this.buildPaginatedListResponse(rawEvents, page, pageSize, total);
  }

  async listStudentEvents(
    actor: WorkflowActorContext,
    options?: ListEventsOptions
  ): Promise<EventListResponseDto> {
    this.ensureActorHasRole(actor, "STUDENT", "Only students can view student events.");
    const contexts = await this.eventRepository.getStudentContextsForUser(actor.userId);
    return this.listAudienceScopedEvents(contexts, options, ["internal", "student", "public"]);
  }

  async listParentEvents(
    actor: WorkflowActorContext,
    options?: ListEventsOptions
  ): Promise<EventListResponseDto> {
    this.ensureActorHasRole(actor, "PARENT", "Only parents can view parent events.");
    const contexts = await this.eventRepository.getStudentContextsForUser(actor.userId);
    return this.listAudienceScopedEvents(contexts, options, ["internal", "student", "public"]);
  }

  async listPublicEvents(options?: ListEventsOptions): Promise<EventListResponseDto> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    const { events: rawEvents, total } = await this.eventRepository.findAll({
      ...options,
      page,
      pageSize,
      lifecycleStatuses: ["published"],
      visibilities: ["public"],
    });

    return this.buildPaginatedListResponse(rawEvents, page, pageSize, total);
  }

  /**
   * Compute time range string from session config.
   *
   * @param config - Event session configuration
   * @returns Formatted time range, e.g., "07:00 - 08:00 AM"
   */
  private computeTimeRange(config: EventSessionConfig): string {
    if (!config?.dates || config.dates.length === 0) {
      return "No sessions";
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);

    // Find today's sessions or use first date's sessions
    let targetDate = config.dates.find((d) => d.date === today);
    if (!targetDate) {
      targetDate = config.dates[0];
    }

    if (!targetDate.sessions || targetDate.sessions.length === 0) {
      return "No sessions";
    }

    // Get earliest open and latest close
    const opens = targetDate.sessions.map((s) => s.opens).sort()[0];
    const closes = targetDate.sessions.map((s) => s.closes).sort().reverse()[0];

    // Format as "HH:mm - HH:mm AM/PM"
    const openTime = this.formatTime12Hour(opens);
    const closeTime = this.formatTime12Hour(closes);

    return `${openTime} - ${closeTime}`;
  }

  /**
   * Convert 24h time to 12h format.
   */
  private formatTime12Hour(time24: string): string {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
  }

  /**
   * Compute human-readable audience summary.
   *
   * @param config - Audience configuration
   * @param levelNames - Map of level ID to level name
   * @returns Summary string, e.g., "All Students", "Grades 7-10"
   */
  private computeAudienceSummary(
    config: EventAudienceConfig,
    levelNames: Map<string, string>
  ): string {
    if (!config?.rules || config.rules.length === 0) {
      return "No audience";
    }

    const includeRules = config.rules.filter((r) => r.effect === "include");

    // Check for ALL_STUDENTS
    if (includeRules.some((r) => r.kind === "ALL_STUDENTS")) {
      return "All Students";
    }

    const parts: string[] = [];

    // Level rules
    const levelRules = includeRules.filter((r) => r.kind === "LEVEL") as LevelRule[];
    if (levelRules.length > 0) {
      const levelIds = levelRules.flatMap((r) => r.levelIds);
      const names = levelIds.map((id) => levelNames.get(id) ?? "Unknown").sort();
      
      if (names.length === 1) {
        parts.push(names[0]);
      } else if (names.length <= 3) {
        parts.push(names.join(", "));
      } else {
        parts.push(`${names.slice(0, 2).join(", ")} +${names.length - 2} more`);
      }
    }

    // Section rules
    const sectionRules = includeRules.filter((r) => r.kind === "SECTION") as SectionRule[];
    if (sectionRules.length > 0) {
      const count = sectionRules.reduce((sum, r) => sum + r.sectionIds.length, 0);
      parts.push(`${count} section${count !== 1 ? "s" : ""}`);
    }

    // Student rules
    const studentRules = includeRules.filter((r) => r.kind === "STUDENT") as StudentRule[];
    if (studentRules.length > 0) {
      const count = studentRules.reduce((sum, r) => sum + r.studentIds.length, 0);
      parts.push(`${count} student${count !== 1 ? "s" : ""}`);
    }

    return parts.length > 0 ? parts.join(", ") : "No audience";
  }

  /**
   * Compute expected attendees based on audience rules.
   *
   * @param config - Audience configuration
   * @param totalActiveStudents - Total count of active students
   * @param repo - Repository for counting
   * @returns Expected number of attendees
   */
  private async computeExpectedAttendees(
    config: EventAudienceConfig,
    totalActiveStudents: number,
    repo: Pick<
      IEventRepository,
      "countStudentsByLevels" | "countStudentsBySections"
    >
  ): Promise<number> {
    if (!config?.rules || config.rules.length === 0) {
      return 0;
    }

    const includeRules = config.rules.filter((r) => r.effect === "include");

    // Check for ALL_STUDENTS
    if (includeRules.some((r) => r.kind === "ALL_STUDENTS")) {
      return totalActiveStudents;
    }

    let count = 0;

    // Count students from level rules
    const levelRules = includeRules.filter((r) => r.kind === "LEVEL") as LevelRule[];
    if (levelRules.length > 0) {
      const levelIds = levelRules.flatMap((r) => r.levelIds);
      count += await repo.countStudentsByLevels(levelIds);
    }

    // Count students from section rules
    const sectionRules = includeRules.filter((r) => r.kind === "SECTION") as SectionRule[];
    if (sectionRules.length > 0) {
      const sectionIds = sectionRules.flatMap((r) => r.sectionIds);
      count += await repo.countStudentsBySections(sectionIds);
    }

    // Count students from student rules (direct count)
    const studentRules = includeRules.filter((r) => r.kind === "STUDENT") as StudentRule[];
    if (studentRules.length > 0) {
      count += studentRules.reduce((sum, r) => sum + r.studentIds.length, 0);
    }

    return count;
  }

  /**
   * Compute event status based on dates and current time.
   *
   * @param startDate - Event start date (YYYY-MM-DD)
   * @param endDate - Event end date (YYYY-MM-DD)
   * @param sessionConfig - Session configuration
   * @returns Event status: live, scheduled, or completed
   */
  private computeEventStatus(
    startDate: string,
    endDate: string,
    sessionConfig: EventSessionConfig
  ): EventStatus {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm

    // If event hasn't started yet
    if (today < startDate) {
      return "scheduled";
    }

    // If event has ended
    if (today > endDate) {
      return "completed";
    }

    // Event is within date range - check if any session is live
    const todayConfig = sessionConfig?.dates?.find((d) => d.date === today);
    if (!todayConfig || !todayConfig.sessions || todayConfig.sessions.length === 0) {
      // No sessions configured for today
      return today === startDate ? "scheduled" : "completed";
    }

    // Check if current time is within any session
    for (const session of todayConfig.sessions) {
      if (currentTime >= session.opens && currentTime <= session.closes) {
        return "live";
      }
    }

    // Check if all sessions have ended today
    const allSessionsEnded = todayConfig.sessions.every(
      (s) => currentTime > s.closes
    );

    if (allSessionsEnded && today === endDate) {
      return "completed";
    }

    // Some sessions haven't started yet today
    return "scheduled";
  }

  /**
   * Create a new event with full validation.
   *
   * @param dto - Event creation data from the frontend
   * @param actor - Authenticated user context
   * @returns Created event DTO ready for API response
   *
   * @throws ValidationError if input data is invalid
   * @throws NotFoundError if facility doesn't exist
   */
  async createEvent(dto: CreateEventDto, actor: WorkflowActorContext): Promise<EventDto> {
    // Step 1: Validate input
    const validation = this.validateCreateEvent(dto);
    if (!validation.isValid || !validation.data) {
      throw new ValidationError("Invalid event data", validation.errors);
    }

    const validatedDto = { ...validation.data };
    const now = new Date().toISOString();

    validatedDto.ownerUserId = validatedDto.ownerUserId ?? actor.userId;
    validatedDto.lifecycleStatus = "pending_approval";
    validatedDto.submittedForApprovalAt = now;
    validatedDto.approvedBy = null;
    validatedDto.approvedAt = null;
    validatedDto.approvalComment = null;
    validatedDto.rejectedBy = null;
    validatedDto.rejectedAt = null;
    validatedDto.rejectionComment = null;
    validatedDto.publishedAt = null;
    validatedDto.completedAt = null;
    validatedDto.cancelledBy = null;
    validatedDto.cancelledAt = null;
    validatedDto.cancellationReason = null;

    // Step 2: Check facility exists if provided
    if (validatedDto.facilityId) {
      const facilityExists = await this.eventRepository.facilityExists(
        validatedDto.facilityId
      );
      if (!facilityExists) {
        throw new NotFoundError(
          "Selected venue does not exist or is not operational",
          "facility",
          validatedDto.facilityId
        );
      }
    }

    // Step 3: Create event in database
    const createdRow = await this.eventRepository.create(validatedDto, actor.userId);

    // Step 4: Fetch with relations for complete DTO
    const eventDto = await this.eventRepository.findByIdWithFacility(createdRow.id);
    if (!eventDto) {
      // This shouldn't happen, but handle gracefully
      throw new Error("Failed to retrieve created event");
    }

    return eventDto;
  }

  /**
   * Update an existing event with validation.
   *
   * @param dto - Event update data
   * @param updatedBy - UUID of the authenticated user
   * @returns Updated event DTO ready for API response
   *
   * @throws ValidationError if input data is invalid
   * @throws NotFoundError if event or facility doesn't exist
   */
  async updateEvent(dto: UpdateEventDto, actor: WorkflowActorContext): Promise<EventDto> {
    // Step 1: Check event exists
    const existingEvent = await this.eventRepository.findById(dto.id);
    if (!existingEvent) {
      throw new NotFoundError("Event not found", "event", dto.id);
    }

    if (!this.canManageEvent(existingEvent, actor)) {
      throw new BusinessRuleError("You do not have permission to modify this event.");
    }

    this.assertEventMutable(existingEvent, dto.workflowAction, this.isAdmin(actor));

    // Step 2: Validate input
    const validation = this.validateUpdateEvent(dto);
    if (!validation.isValid || !validation.data) {
      throw new ValidationError("Invalid event data", validation.errors);
    }

    const validatedDto = validation.data;

    // Step 3: Check facility exists if provided
    if (validatedDto.facilityId) {
      const facilityExists = await this.eventRepository.facilityExists(
        validatedDto.facilityId
      );
      if (!facilityExists) {
        throw new NotFoundError(
          "Selected venue does not exist or is not operational",
          "facility",
          validatedDto.facilityId
        );
      }
    }

    // Step 4: Update event in database
    const updatePayload: UpdateEventDto = { ...validatedDto };

    this.normalizeRegistrationPayload(existingEvent, updatePayload);
    this.assertRegistrationState(existingEvent, updatePayload);

    if (dto.workflowAction) {
      const workflowMutations = this.applyWorkflowAction(
        existingEvent,
        dto.workflowAction,
        actor,
        {
          comment: dto.workflowComment,
          reason: dto.actionReason,
        },
        updatePayload
      );
      Object.assign(updatePayload, workflowMutations);
    } else if (this.shouldResetApproval(existingEvent, updatePayload)) {
      Object.assign(updatePayload, this.buildApprovalResetPayload());
    }

    await this.eventRepository.update(updatePayload, actor.userId);

    // Step 5: Fetch with relations for complete DTO
    const eventDto = await this.eventRepository.findByIdWithFacility(dto.id);
    if (!eventDto) {
      throw new Error("Failed to retrieve updated event");
    }

    return eventDto;
  }

  /**
   * Validate event update input.
   *
   * @param input - Raw input data
   * @returns Validation result with sanitized data if valid
   */
  validateUpdateEvent(input: unknown): ValidationResult<UpdateEventDto> {
    const errors: ValidationErrorDetail[] = [];
    const data = (input ?? {}) as Record<string, unknown>;

    // ID is required
    const id = typeof data.id === "string" ? data.id.trim() : "";
    if (!id) {
      errors.push({
        field: "id",
        message: "Event ID is required",
        code: "REQUIRED",
      });
    } else if (!this.isValidUuid(id)) {
      errors.push({
        field: "id",
        message: "Invalid event ID format",
        code: "INVALID_FORMAT",
      });
    }

    // Title validation (optional for update, but if provided must be valid)
    let rawTitle: string | undefined;
    if (data.title !== undefined) {
      rawTitle = typeof data.title === "string" ? data.title.trim() : "";
      if (!rawTitle) {
        errors.push({
          field: "title",
          message: "Event title cannot be empty",
          code: "REQUIRED",
        });
      } else if (rawTitle.length > 200) {
        errors.push({
          field: "title",
          message: "Event title must be 200 characters or less",
          code: "MAX_LENGTH",
        });
      }
    }

    // Description validation (optional)
    const rawDescription =
      data.description !== undefined
        ? typeof data.description === "string"
          ? data.description.trim()
          : ""
        : undefined;

    const posterImageUrl =
      data.posterImageUrl === null
        ? null
        : typeof data.posterImageUrl === "string"
        ? data.posterImageUrl.trim()
        : undefined;

    // Date validation (optional for update)
    let rawStartDate: string | undefined;
    let rawEndDate: string | undefined;

    if (data.startDate !== undefined) {
      rawStartDate = typeof data.startDate === "string" ? data.startDate.trim() : "";
      if (rawStartDate && !this.isValidDateString(rawStartDate)) {
        errors.push({
          field: "startDate",
          message: "Start date must be in YYYY-MM-DD format",
          code: "INVALID_FORMAT",
        });
      }
    }

    if (data.endDate !== undefined) {
      rawEndDate = typeof data.endDate === "string" ? data.endDate.trim() : "";
      if (rawEndDate && !this.isValidDateString(rawEndDate)) {
        errors.push({
          field: "endDate",
          message: "End date must be in YYYY-MM-DD format",
          code: "INVALID_FORMAT",
        });
      }
    }

    // Check date range validity if both provided
    if (rawStartDate && rawEndDate && rawStartDate > rawEndDate) {
      errors.push({
        field: "endDate",
        message: "End date cannot be before start date",
        code: "INVALID_RANGE",
      });
    }

    // Facility validation (optional)
    let rawFacilityId: string | null | undefined;
    if (data.facilityId !== undefined) {
      if (data.facilityId === null || data.facilityId === "") {
        rawFacilityId = null;
      } else if (typeof data.facilityId === "string") {
        rawFacilityId = data.facilityId.trim();
        if (rawFacilityId && !this.isValidUuid(rawFacilityId)) {
          errors.push({
            field: "facilityId",
            message: "Invalid facility ID format",
            code: "INVALID_FORMAT",
          });
        }
      }
    }

    // Audience config validation (optional)
    let audienceConfig: EventAudienceConfig | undefined;
    if (data.audienceConfig !== undefined) {
      const audienceConfigResult = this.validateAudienceConfig(data.audienceConfig);
      if (!audienceConfigResult.isValid) {
        errors.push(...audienceConfigResult.errors);
      } else {
        audienceConfig = audienceConfigResult.data;
      }
    }

    // Scanner config validation (optional)
    let scannerConfig: EventScannerConfig | undefined;
    if (data.scannerConfig !== undefined) {
      const scannerConfigResult = this.validateScannerConfig(data.scannerConfig);
      if (!scannerConfigResult.isValid) {
        errors.push(...scannerConfigResult.errors);
      } else {
        scannerConfig = scannerConfigResult.data;
      }
    }

    // Session config validation (optional)
    let sessionConfig: EventSessionConfig | undefined;
    if (data.sessionConfig !== undefined) {
      const sessionConfigResult = this.validateSessionConfig(data.sessionConfig);
      if (!sessionConfigResult.isValid) {
        errors.push(...sessionConfigResult.errors);
      } else {
        sessionConfig = sessionConfigResult.data;
      }
    }

    // Visibility validation (optional)
    let visibility: EventVisibility | undefined;
    if (data.visibility !== undefined) {
      const value = typeof data.visibility === "string" ? data.visibility.trim().toLowerCase() : "";
      if (!ALLOWED_VISIBILITY_VALUES.includes(value as EventVisibility)) {
        errors.push({
          field: "visibility",
          message: "Visibility must be one of: internal, student, public",
          code: "INVALID_VALUE",
        });
      } else {
        visibility = value as EventVisibility;
      }
    }

    // Registration fields (optional)
    let registrationRequired: boolean | undefined;
    if (data.registrationRequired !== undefined) {
      if (typeof data.registrationRequired !== "boolean") {
        errors.push({
          field: "registrationRequired",
          message: "registrationRequired must be a boolean",
          code: "INVALID_TYPE",
        });
      } else {
        registrationRequired = data.registrationRequired;
      }
    }

    const registrationOpensAt = this.normalizeTimestampField(
      data.registrationOpensAt,
      "registrationOpensAt",
      errors
    );
    const registrationClosesAt = this.normalizeTimestampField(
      data.registrationClosesAt,
      "registrationClosesAt",
      errors
    );

    if (registrationRequired === true) {
      if (registrationOpensAt === undefined || registrationOpensAt === null) {
        errors.push({
          field: "registrationOpensAt",
          message: "registrationOpensAt is required when registration is enabled",
          code: "REQUIRED",
        });
      }
      if (registrationClosesAt === undefined || registrationClosesAt === null) {
        errors.push({
          field: "registrationClosesAt",
          message: "registrationClosesAt is required when registration is enabled",
          code: "REQUIRED",
        });
      }
    }

    if (
      registrationOpensAt &&
      registrationClosesAt &&
      registrationOpensAt !== null &&
      registrationClosesAt !== null &&
      registrationOpensAt > registrationClosesAt
    ) {
      errors.push({
        field: "registrationClosesAt",
        message: "registrationClosesAt must be after registrationOpensAt",
        code: "INVALID_RANGE",
      });
    }

    const capacityLimit = this.parseCapacityLimit(
      data.capacityLimit,
      "capacityLimit",
      errors
    );

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        id,
        title: rawTitle,
        description: rawDescription,
        posterImageUrl,
        startDate: rawStartDate,
        endDate: rawEndDate,
        facilityId: rawFacilityId,
        audienceConfig,
        scannerConfig,
        sessionConfig,
        visibility,
        registrationRequired,
        registrationOpensAt,
        registrationClosesAt,
        capacityLimit,
      },
    };
  }

  /**
   * Validate event creation input without persisting.
   *
   * @param input - Raw input data (may be partial/invalid)
   * @returns Validation result with sanitized data if valid
   */
  validateCreateEvent(input: unknown): ValidationResult<CreateEventDto> {
    const errors: ValidationErrorDetail[] = [];
    const data = (input ?? {}) as Record<string, unknown>;

    // === Title validation ===
    const rawTitle = typeof data.title === "string" ? data.title.trim() : "";
    if (!rawTitle) {
      errors.push({
        field: "title",
        message: "Event title is required",
        code: "REQUIRED",
      });
    } else if (rawTitle.length > 200) {
      errors.push({
        field: "title",
        message: "Event title must be 200 characters or less",
        code: "MAX_LENGTH",
      });
    }

    // === Description validation (optional) ===
    const rawDescription =
      typeof data.description === "string" ? data.description.trim() : undefined;

    const rawPosterImageUrl =
      typeof data.posterImageUrl === "string" ? data.posterImageUrl.trim() : undefined;

    // === Date validation ===
    const rawStartDate =
      typeof data.startDate === "string" ? data.startDate.trim() : "";
    const rawEndDate =
      typeof data.endDate === "string" ? data.endDate.trim() : "";

    if (!rawStartDate) {
      errors.push({
        field: "startDate",
        message: "Start date is required",
        code: "REQUIRED",
      });
    } else if (!this.isValidDateString(rawStartDate)) {
      errors.push({
        field: "startDate",
        message: "Start date must be in YYYY-MM-DD format",
        code: "INVALID_FORMAT",
      });
    }

    if (!rawEndDate) {
      errors.push({
        field: "endDate",
        message: "End date is required",
        code: "REQUIRED",
      });
    } else if (!this.isValidDateString(rawEndDate)) {
      errors.push({
        field: "endDate",
        message: "End date must be in YYYY-MM-DD format",
        code: "INVALID_FORMAT",
      });
    }

    // Check date range validity
    if (rawStartDate && rawEndDate && rawStartDate > rawEndDate) {
      errors.push({
        field: "endDate",
        message: "End date cannot be before start date",
        code: "INVALID_RANGE",
      });
    }

    // === Facility validation (optional) ===
    const rawFacilityId =
      typeof data.facilityId === "string" ? data.facilityId.trim() : undefined;
    if (rawFacilityId && !this.isValidUuid(rawFacilityId)) {
      errors.push({
        field: "facilityId",
        message: "Invalid facility ID format",
        code: "INVALID_FORMAT",
      });
    }

    // === Audience config validation ===
    const audienceConfigResult = this.validateAudienceConfig(data.audienceConfig);
    if (!audienceConfigResult.isValid) {
      errors.push(...audienceConfigResult.errors);
    }

    // === Session config validation ===
    const sessionConfigResult = this.validateSessionConfig(data.sessionConfig);
    if (!sessionConfigResult.isValid) {
      errors.push(...sessionConfigResult.errors);
    }

    // === Scanner config validation ===
    const scannerConfigResult = this.validateScannerConfig(data.scannerConfig);
    if (!scannerConfigResult.isValid) {
      errors.push(...scannerConfigResult.errors);
    }

    // === Visibility validation ===
    const rawVisibility =
      typeof data.visibility === "string" ? data.visibility.trim().toLowerCase() : "";
    let visibility: EventVisibility | undefined;
    if (!rawVisibility) {
      errors.push({
        field: "visibility",
        message: "Visibility is required",
        code: "REQUIRED",
      });
    } else if (!ALLOWED_VISIBILITY_VALUES.includes(rawVisibility as EventVisibility)) {
      errors.push({
        field: "visibility",
        message: "Visibility must be one of: internal, student, public",
        code: "INVALID_VALUE",
      });
    } else {
      visibility = rawVisibility as EventVisibility;
    }

    // === Registration metadata ===
    if (typeof data.registrationRequired !== "boolean") {
      errors.push({
        field: "registrationRequired",
        message: "registrationRequired is required",
        code: "REQUIRED",
      });
    }

    const registrationRequired = data.registrationRequired === true;
    const registrationOpensAt = this.normalizeTimestampField(
      data.registrationOpensAt,
      "registrationOpensAt",
      errors,
      { required: registrationRequired }
    );
    const registrationClosesAt = this.normalizeTimestampField(
      data.registrationClosesAt,
      "registrationClosesAt",
      errors,
      { required: registrationRequired }
    );

    if (
      registrationOpensAt &&
      registrationClosesAt &&
      registrationOpensAt !== null &&
      registrationClosesAt !== null &&
      registrationOpensAt > registrationClosesAt
    ) {
      errors.push({
        field: "registrationClosesAt",
        message: "registrationClosesAt must be after registrationOpensAt",
        code: "INVALID_RANGE",
      });
    }

    const capacityLimit = this.parseCapacityLimit(
      data.capacityLimit,
      "capacityLimit",
      errors
    );

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        title: rawTitle,
        description: rawDescription,
        posterImageUrl: rawPosterImageUrl,
        startDate: rawStartDate,
        endDate: rawEndDate,
        facilityId: rawFacilityId,
        audienceConfig: audienceConfigResult.data!,
        sessionConfig: sessionConfigResult.data!,
        scannerConfig: scannerConfigResult.data!,
        visibility: visibility!,
        registrationRequired,
        registrationOpensAt: registrationOpensAt ?? null,
        registrationClosesAt: registrationClosesAt ?? null,
        capacityLimit: capacityLimit ?? null,
      },
    };
  }

  private validateScannerConfig(
    input: unknown
  ): ValidationResult<EventScannerConfig> {
    const errors: ValidationErrorDetail[] = [];

    if (!input || typeof input !== "object") {
      errors.push({
        field: "scannerConfig",
        message: "Scanner configuration is required",
        code: "REQUIRED",
      });
      return { isValid: false, errors };
    }

    const config = input as Record<string, unknown>;

    if (config.version !== 1) {
      errors.push({
        field: "scannerConfig.version",
        message: "Scanner config version must be 1",
        code: "INVALID_VERSION",
      });
    }

    if (!Array.isArray(config.scannerIds)) {
      errors.push({
        field: "scannerConfig.scannerIds",
        message: "scannerIds must be an array",
        code: "INVALID_TYPE",
      });
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: config as unknown as EventScannerConfig,
    };
  }

  /**
   * Validate a single audience rule.
   */
  private validateAudienceRule(
    rule: AudienceRule,
    index: number
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];
    const fieldPrefix = `audienceConfig.rules[${index}]`;

    if (!rule.kind) {
      errors.push({
        field: `${fieldPrefix}.kind`,
        message: "Rule kind is required",
        code: "REQUIRED",
      });
      return errors;
    }

    if (!["include", "exclude"].includes(rule.effect)) {
      errors.push({
        field: `${fieldPrefix}.effect`,
        message: "Rule effect must be 'include' or 'exclude'",
        code: "INVALID_VALUE",
      });
    }

    switch (rule.kind) {
      case "ALL_STUDENTS":
        // No additional validation needed
        break;
      case "LEVEL":
        if (!Array.isArray(rule.levelIds) || rule.levelIds.length === 0) {
          errors.push({
            field: `${fieldPrefix}.levelIds`,
            message: "Level IDs are required for LEVEL rules",
            code: "REQUIRED",
          });
        }
        break;
      case "SECTION":
        if (!Array.isArray(rule.sectionIds) || rule.sectionIds.length === 0) {
          errors.push({
            field: `${fieldPrefix}.sectionIds`,
            message: "Section IDs are required for SECTION rules",
            code: "REQUIRED",
          });
        }
        break;
      case "STUDENT":
        if (!Array.isArray(rule.studentIds) || rule.studentIds.length === 0) {
          errors.push({
            field: `${fieldPrefix}.studentIds`,
            message: "Student IDs are required for STUDENT rules",
            code: "REQUIRED",
          });
        }
        break;
      default:
        errors.push({
          field: `${fieldPrefix}.kind`,
          message: `Unknown rule kind: ${(rule as AudienceRule).kind}`,
          code: "INVALID_VALUE",
        });
    }

    return errors;
  }

  /**
   * Validate session configuration structure.
   */
  private validateSessionConfig(
    input: unknown
  ): ValidationResult<EventSessionConfig> {
    const errors: ValidationErrorDetail[] = [];

    if (!input || typeof input !== "object") {
      errors.push({
        field: "sessionConfig",
        message: "Session configuration is required",
        code: "REQUIRED",
      });
      return { isValid: false, errors };
    }

    const config = input as Record<string, unknown>;

    // Check version
    if (config.version !== 2) {
      errors.push({
        field: "sessionConfig.version",
        message: "Session config version must be 2",
        code: "INVALID_VERSION",
      });
    }

    // Check dates array
    if (!Array.isArray(config.dates)) {
      errors.push({
        field: "sessionConfig.dates",
        message: "Session dates must be an array",
        code: "INVALID_TYPE",
      });
      return { isValid: false, errors };
    }

    const dates = config.dates as Array<Record<string, unknown>>;

    if (dates.length === 0) {
      errors.push({
        field: "sessionConfig.dates",
        message: "At least one date configuration is required",
        code: "EMPTY_ARRAY",
      });
    }

    // Validate each date configuration
    for (let i = 0; i < dates.length; i++) {
      const dateConfig = dates[i];
      const fieldPrefix = `sessionConfig.dates[${i}]`;

      if (!dateConfig.date || typeof dateConfig.date !== "string") {
        errors.push({
          field: `${fieldPrefix}.date`,
          message: "Date is required",
          code: "REQUIRED",
        });
      } else if (!this.isValidDateString(dateConfig.date)) {
        errors.push({
          field: `${fieldPrefix}.date`,
          message: "Date must be in YYYY-MM-DD format",
          code: "INVALID_FORMAT",
        });
      }

      if (!Array.isArray(dateConfig.sessions)) {
        errors.push({
          field: `${fieldPrefix}.sessions`,
          message: "Sessions must be an array",
          code: "INVALID_TYPE",
        });
        continue;
      }

      // Validate sessions have required fields
      const sessions = dateConfig.sessions as Array<Record<string, unknown>>;
      for (let j = 0; j < sessions.length; j++) {
        const session = sessions[j];
        const sessionPrefix = `${fieldPrefix}.sessions[${j}]`;

        if (!session.id || typeof session.id !== "string") {
          errors.push({
            field: `${sessionPrefix}.id`,
            message: "Session ID is required",
            code: "REQUIRED",
          });
        }

        if (!session.name || typeof session.name !== "string") {
          errors.push({
            field: `${sessionPrefix}.name`,
            message: "Session name is required",
            code: "REQUIRED",
          });
        }

        if (!session.opens || typeof session.opens !== "string") {
          errors.push({
            field: `${sessionPrefix}.opens`,
            message: "Session open time is required",
            code: "REQUIRED",
          });
        } else if (!this.isValidTimeString(session.opens)) {
          errors.push({
            field: `${sessionPrefix}.opens`,
            message: "Open time must be in HH:mm format",
            code: "INVALID_FORMAT",
          });
        }

        if (!session.closes || typeof session.closes !== "string") {
          errors.push({
            field: `${sessionPrefix}.closes`,
            message: "Session close time is required",
            code: "REQUIRED",
          });
        } else if (!this.isValidTimeString(session.closes)) {
          errors.push({
            field: `${sessionPrefix}.closes`,
            message: "Close time must be in HH:mm format",
            code: "INVALID_FORMAT",
          });
        }

        // lateAfter is optional (null for exit sessions)
        if (
          session.lateAfter !== null &&
          session.lateAfter !== undefined &&
          typeof session.lateAfter === "string" &&
          session.lateAfter !== "" &&
          !this.isValidTimeString(session.lateAfter)
        ) {
          errors.push({
            field: `${sessionPrefix}.lateAfter`,
            message: "Late threshold time must be in HH:mm format",
            code: "INVALID_FORMAT",
          });
        }
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: config as unknown as EventSessionConfig,
    };
  }

  /**
   * Validate audience configuration structure.
   */
  private validateAudienceConfig(
    input: unknown
  ): ValidationResult<EventAudienceConfig> {
    const errors: ValidationErrorDetail[] = [];

    if (!input || typeof input !== "object") {
      errors.push({
        field: "audienceConfig",
        message: "Audience configuration is required",
        code: "REQUIRED",
      });
      return { isValid: false, errors };
    }

    const config = input as Record<string, unknown>;

    // Check version
    if (config.version !== 1) {
      errors.push({
        field: "audienceConfig.version",
        message: "Audience config version must be 1",
        code: "INVALID_VERSION",
      });
    }

    // Check rules array
    if (!Array.isArray(config.rules)) {
      errors.push({
        field: "audienceConfig.rules",
        message: "Audience rules must be an array",
        code: "INVALID_TYPE",
      });
      return { isValid: false, errors };
    }

    // Validate each rule
    const rules = config.rules as AudienceRule[];
    const hasIncludeRule = rules.some((rule) => rule.effect === "include");

    if (!hasIncludeRule) {
      errors.push({
        field: "audienceConfig.rules",
        message: "At least one include rule is required",
        code: "NO_INCLUDE_RULE",
      });
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const ruleErrors = this.validateAudienceRule(rule, i);
      errors.push(...ruleErrors);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        version: 1,
        rules,
      },
    };
  }

  private canManageEvent(event: EventRow, actor: WorkflowActorContext): boolean {
    if (this.isAdmin(actor)) {
      return true;
    }
    return (
      event.owner_user_id === actor.userId &&
      actor.roles.some((role) => ORGANIZER_ROLE_SET.has(role))
    );
  }

  private isAdmin(actor: WorkflowActorContext): boolean {
    return actor.roles.some((role) => ADMIN_ROLES.includes(role));
  }

  private isOrganizer(actor: WorkflowActorContext): boolean {
    return actor.roles.some((role) => ORGANIZER_ROLE_SET.has(role));
  }

  private ensureActorHasRole(
    actor: WorkflowActorContext,
    requiredRole: UserRole,
    errorMessage: string
  ): void {
    if (!actor.roles.includes(requiredRole)) {
      throw new BusinessRuleError(errorMessage);
    }
  }

  private async listAudienceScopedEvents(
    contexts: StudentAudienceContext[],
    options: ListEventsOptions | undefined,
    visibilities: EventVisibility[]
  ): Promise<EventListResponseDto> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    if (!contexts || contexts.length === 0) {
      return this.buildPaginatedListResponse([], page, pageSize, 0);
    }

    const { events: rawEvents } = await this.eventRepository.findAll({
      ...options,
      page: 1,
      pageSize: page * pageSize,
      lifecycleStatuses: ["published"],
      visibilities,
      disablePagination: true,
    });

    const eligibleEvents = rawEvents.filter((event) =>
      this.eventMatchesContexts(event.target_audience as EventAudienceConfig, contexts)
    );

    const total = eligibleEvents.length;
    const offset = (page - 1) * pageSize;
    const pagedEvents = eligibleEvents.slice(offset, offset + pageSize);

    return this.buildPaginatedListResponse(pagedEvents, page, pageSize, total);
  }

  private eventMatchesContexts(
    audienceConfig: EventAudienceConfig,
    contexts: StudentAudienceContext[]
  ): boolean {
    if (!audienceConfig?.rules || audienceConfig.rules.length === 0) {
      return false;
    }

    return contexts.some((context) => this.isContextEligible(audienceConfig, context));
  }

  private isContextEligible(
    audienceConfig: EventAudienceConfig,
    context: StudentAudienceContext
  ): boolean {
    const includeRules = audienceConfig.rules.filter((rule) => rule.effect === "include");
    const excludeRules = audienceConfig.rules.filter((rule) => rule.effect === "exclude");

    const isIncluded = includeRules.some((rule) => this.ruleMatchesContext(rule, context));
    if (!isIncluded) {
      return false;
    }

    const isExcluded = excludeRules.some((rule) => this.ruleMatchesContext(rule, context));
    return !isExcluded;
  }

  private ruleMatchesContext(rule: AudienceRule, context: StudentAudienceContext): boolean {
    switch (rule.kind) {
      case "ALL_STUDENTS":
        return true;
      case "LEVEL":
        return !!context.levelId && rule.levelIds?.includes(context.levelId);
      case "SECTION":
        return !!context.sectionId && rule.sectionIds?.includes(context.sectionId);
      case "STUDENT":
        return rule.studentIds?.includes(context.studentId) ?? false;
      default:
        return false;
    }
  }

  private async buildPaginatedListResponse(
    rawEvents: EventWithFacilityRow[],
    page: number,
    pageSize: number,
    total: number
  ): Promise<EventListResponseDto> {
    if (rawEvents.length === 0) {
      return {
        events: [],
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    }

    const totalActiveStudents = await this.eventRepository.countActiveStudents();
    const allLevelIds = new Set<string>();

    for (const event of rawEvents) {
      const config = event.target_audience as EventAudienceConfig;
      if (config?.rules) {
        for (const rule of config.rules) {
          if (rule.kind === "LEVEL") {
            (rule.levelIds ?? []).forEach((id) => allLevelIds.add(id));
          }
        }
      }
    }

    const levelNames = await this.eventRepository.getLevelNames(Array.from(allLevelIds));

    const events: EventListItemDto[] = await Promise.all(
      rawEvents.map(async (event) => {
        const audienceConfig = event.target_audience as EventAudienceConfig;
        const sessionConfig = event.session_config as EventSessionConfig;
        const scannerConfig = event.scanner_assignments as EventScannerConfig;
        const startDate = event.start_date ?? event.event_date ?? "";
        const endDate = event.end_date ?? event.start_date ?? event.event_date ?? "";

        const timeRange = this.computeTimeRange(sessionConfig);
        const audienceSummary = this.computeAudienceSummary(audienceConfig, levelNames);

        const scannerIds = Array.isArray(scannerConfig?.scannerIds)
          ? scannerConfig.scannerIds
          : [];
        const scannerSummary =
          scannerIds.length === 0
            ? "No scanners"
            : scannerIds.length === 1
            ? "1 scanner"
            : `${scannerIds.length} scanners`;

        const expectedAttendees = await this.computeExpectedAttendees(
          audienceConfig,
          totalActiveStudents,
          this.eventRepository
        );
        const actualAttendees = await this.eventRepository.countEventAttendees(event.id);
        const status = this.computeEventStatus(startDate, endDate, sessionConfig);

        return {
          id: event.id,
          title: event.title,
          timeRange,
          venue: event.facilities?.name ?? null,
          description: event.description ?? null,
          audienceSummary,
          scannerSummary,
          actualAttendees,
          expectedAttendees,
          status,
          startDate,
          endDate,
          lifecycleStatus: event.lifecycle_status,
          visibility: event.visibility,
          posterImageUrl: event.poster_image_url ?? null,
        } as EventListItemDto;
      })
    );

    return {
      events,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  private assertEventMutable(
    event: EventRow,
    action: EventWorkflowAction | undefined,
    actorIsAdmin: boolean
  ): void {
    if (event.lifecycle_status === "completed" || event.lifecycle_status === "cancelled") {
      throw new BusinessRuleError("Completed or cancelled events can no longer be modified.");
    }

    if (!action) {
      if (event.lifecycle_status === "published") {
        throw new BusinessRuleError(
          "Published events require workflow actions (complete/cancel) for changes."
        );
      }

      if (event.lifecycle_status === "pending_approval" && !actorIsAdmin) {
        throw new BusinessRuleError("Only administrators can edit events pending approval.");
      }
    }
  }

  private applyWorkflowAction(
    event: EventRow,
    action: EventWorkflowAction,
    actor: WorkflowActorContext,
    options?: { comment?: string | null; reason?: string | null },
    pendingUpdates?: UpdateEventDto
  ): Partial<UpdateEventDto> {
    const now = new Date().toISOString();

    switch (action) {
      case "SUBMIT_FOR_APPROVAL": {
        if (event.lifecycle_status !== "draft") {
          throw new BusinessRuleError("Only draft events can be submitted for approval.");
        }
        if (!this.isAdmin(actor) && event.owner_user_id !== actor.userId) {
          throw new BusinessRuleError("You are not allowed to submit this event.");
        }
        return {
          lifecycleStatus: "pending_approval",
          submittedForApprovalAt: now,
          rejectedBy: null,
          rejectedAt: null,
          rejectionComment: null,
        };
      }
      case "APPROVE": {
        if (event.lifecycle_status !== "pending_approval") {
          throw new BusinessRuleError("Only pending events can be approved.");
        }
        if (!this.isAdmin(actor)) {
          throw new BusinessRuleError("Only administrators can approve events.");
        }
        return {
          lifecycleStatus: "approved",
          approvedBy: actor.userId,
          approvedAt: now,
          approvalComment: options?.comment ?? null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionComment: null,
        };
      }
      case "REJECT": {
        if (event.lifecycle_status !== "pending_approval") {
          throw new BusinessRuleError("Only pending events can be rejected.");
        }
        if (!this.isAdmin(actor)) {
          throw new BusinessRuleError("Only administrators can reject events.");
        }
        if (!options?.comment || options.comment.trim().length === 0) {
          throw new BusinessRuleError("A rejection comment is required.");
        }
        return {
          lifecycleStatus: "draft",
          rejectedBy: actor.userId,
          rejectedAt: now,
          rejectionComment: options.comment,
          approvedBy: null,
          approvedAt: null,
          approvalComment: null,
          submittedForApprovalAt: null,
        };
      }
      case "PUBLISH": {
        if (event.lifecycle_status !== "approved") {
          throw new BusinessRuleError("Only approved events can be published.");
        }
        if (!this.isAdmin(actor)) {
          throw new BusinessRuleError("Only administrators can publish events.");
        }
        this.assertPublishPreconditions(event, pendingUpdates);
        return {
          lifecycleStatus: "published",
          publishedAt: now,
        };
      }
      case "COMPLETE": {
        if (event.lifecycle_status !== "published") {
          throw new BusinessRuleError("Only published events can be completed.");
        }
        if (!this.isAdmin(actor)) {
          throw new BusinessRuleError("Only administrators can complete events.");
        }
        return {
          lifecycleStatus: "completed",
          completedAt: now,
        };
      }
      case "CANCEL": {
        if (!this.isAdmin(actor)) {
          throw new BusinessRuleError("Only administrators can cancel events.");
        }
        if (event.lifecycle_status === "completed" || event.lifecycle_status === "cancelled") {
          throw new BusinessRuleError("This event can no longer be cancelled.");
        }
        const cancellationReason = options?.reason?.trim();
        if (!cancellationReason) {
          throw new BusinessRuleError("A cancellation reason is required.");
        }
        return {
          lifecycleStatus: "cancelled",
          cancelledBy: actor.userId,
          cancelledAt: now,
          cancellationReason,
        };
      }
      default:
        throw new BusinessRuleError(`Unsupported workflow action: ${action}`);
    }
  }

  private normalizeRegistrationPayload(event: EventRow, payload: UpdateEventDto): void {
    const registrationRequired =
      payload.registrationRequired ?? event.registration_required;

    if (!registrationRequired) {
      payload.registrationOpensAt = null;
      payload.registrationClosesAt = null;
      payload.capacityLimit = null;
    }
  }

  private getFinalRegistrationState(
    event: EventRow,
    updates?: UpdateEventDto
  ): {
    required: boolean;
    registrationOpensAt: string | null;
    registrationClosesAt: string | null;
    capacityLimit: number | null;
  } {
    const required = updates?.registrationRequired ?? event.registration_required;

    const registrationOpensAt =
      updates?.registrationOpensAt !== undefined
        ? updates.registrationOpensAt
        : event.registration_opens_at;

    const registrationClosesAt =
      updates?.registrationClosesAt !== undefined
        ? updates.registrationClosesAt
        : event.registration_closes_at;

    const capacityLimit =
      updates?.capacityLimit !== undefined
        ? updates.capacityLimit
        : event.capacity_limit;

    return {
      required,
      registrationOpensAt: registrationOpensAt ?? null,
      registrationClosesAt: registrationClosesAt ?? null,
      capacityLimit: capacityLimit ?? null,
    };
  }

  private assertRegistrationState(event: EventRow, updates: UpdateEventDto): void {
    const state = this.getFinalRegistrationState(event, updates);

    if (!state.required) {
      return;
    }

    if (!state.registrationOpensAt || !state.registrationClosesAt) {
      throw new BusinessRuleError(
        "Registration window must be provided when registration is enabled."
      );
    }

    const opensAt = new Date(state.registrationOpensAt).getTime();
    const closesAt = new Date(state.registrationClosesAt).getTime();

    if (Number.isNaN(opensAt) || Number.isNaN(closesAt) || opensAt >= closesAt) {
      throw new BusinessRuleError(
        "registrationClosesAt must be after registrationOpensAt."
      );
    }

    if (
      state.capacityLimit !== null &&
      state.capacityLimit !== undefined &&
      state.capacityLimit <= 0
    ) {
      throw new BusinessRuleError(
        "capacityLimit must be a positive integer when provided."
      );
    }
  }

  private assertPublishPreconditions(
    event: EventRow,
    pendingUpdates?: UpdateEventDto
  ): void {
    const startDate =
      pendingUpdates?.startDate ??
      event.start_date ??
      event.event_date ??
      null;

    if (!startDate) {
      throw new BusinessRuleError(
        "Events must have a start date before they can be published."
      );
    }

    const registrationState = this.getFinalRegistrationState(
      event,
      pendingUpdates
    );

    if (!registrationState.required) {
      return;
    }

    if (
      !registrationState.registrationOpensAt ||
      !registrationState.registrationClosesAt
    ) {
      throw new BusinessRuleError(
        "Registration window must be defined before publishing events that require registration."
      );
    }

    const opensAt = new Date(registrationState.registrationOpensAt).getTime();
    const closesAt = new Date(registrationState.registrationClosesAt).getTime();

    if (Number.isNaN(opensAt) || Number.isNaN(closesAt) || opensAt >= closesAt) {
      throw new BusinessRuleError(
        "registrationClosesAt must be after registrationOpensAt."
      );
    }

    if (
      registrationState.capacityLimit !== null &&
      registrationState.capacityLimit !== undefined &&
      registrationState.capacityLimit <= 0
    ) {
      throw new BusinessRuleError(
        "capacityLimit must be a positive integer when provided."
      );
    }
  }

  private shouldResetApproval(event: EventRow, payload: UpdateEventDto): boolean {
    if (event.lifecycle_status !== "approved") {
      return false;
    }
    return CRITICAL_FIELDS.some((field) => payload[field] !== undefined);
  }

  private buildApprovalResetPayload(): Partial<UpdateEventDto> {
    const now = new Date().toISOString();
    return {
      lifecycleStatus: "pending_approval",
      approvedBy: null,
      approvedAt: null,
      approvalComment: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionComment: null,
      submittedForApprovalAt: now,
      publishedAt: null,
    };
  }

  private normalizeTimestampField(
    value: unknown,
    field: string,
    errors: ValidationErrorDetail[],
    options?: { required?: boolean }
  ): string | null | undefined {
    if (value === undefined) {
      if (options?.required) {
        errors.push({ field, message: `${field} is required`, code: "REQUIRED" });
      }
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    if (typeof value === "string" && this.isValidDateTimeString(value)) {
      return value;
    }

    errors.push({
      field,
      message: `${field} must be an ISO8601 timestamp`,
      code: "INVALID_FORMAT",
    });
    return undefined;
  }

  private parseCapacityLimit(
    value: unknown,
    field: string,
    errors: ValidationErrorDetail[]
  ): number | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    const numericValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
        ? Number(value)
        : NaN;

    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      errors.push({
        field,
        message: "capacityLimit must be a positive integer",
        code: "INVALID_VALUE",
      });
      return undefined;
    }

    return numericValue;
  }

  /**
   * Delete one or more events by ID.
   *
   * @param ids - Array of event UUIDs to delete
   * @returns Number of events deleted
   */
  async deleteEvents(ids: string[]): Promise<number> {
    const errors: ValidationErrorDetail[] = [];

    const normalizedIds = Array.from(
      new Set(
        (ids ?? []).map((id) =>
          typeof id === "string" ? id.trim() : ""
        )
      )
    ).filter((id) => id.length > 0);

    if (normalizedIds.length === 0) {
      errors.push({
        field: "ids",
        message: "At least one event ID is required",
        code: "REQUIRED",
      });
    }

    for (const id of normalizedIds) {
      if (!this.isValidUuid(id)) {
        errors.push({
          field: "ids",
          message: `Invalid event ID format: ${id}`,
          code: "INVALID_FORMAT",
        });
      }
    }

    if (errors.length > 0) {
      throw new ValidationError("Invalid event IDs", errors);
    }

    const deletedCount = await this.eventRepository.deleteManyByIds(normalizedIds);
    return deletedCount;
  }

  /**
   * Check if a string is a valid YYYY-MM-DD date.
   */
  private isValidDateString(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  /**
   * Check if a string is a valid HH:mm time.
   */
  private isValidTimeString(value: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
  }

  private isValidDateTimeString(value: string): boolean {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }

  /**
   * Check if a string is a valid UUID.
   */
  private isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    );
  }
}
