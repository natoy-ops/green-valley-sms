/**
 * SEMS Domain Interfaces
 *
 * Defines contracts for the repository and service layers following
 * Dependency Inversion Principle (DIP).
 *
 * @remarks
 * - Repositories handle data persistence (database operations only)
 * - Services handle business logic and orchestration
 * - Controllers/API routes handle HTTP concerns
 */

import type {
  CreateEventDto,
  EventDto,
  EventRow,
  ValidationResult,
} from "./types";

// ============================================================================
// Repository Interfaces
// ============================================================================

/**
 * Repository interface for Event persistence operations.
 *
 * @remarks
 * - Single Responsibility: Only handles database CRUD operations
 * - No business logic validation here
 * - Returns raw data or throws on database errors
 */
export interface IEventRepository {
  /**
   * Create a new event in the database.
   *
   * @param event - Event data to insert
   * @param createdBy - UUID of the user creating the event
   * @returns The created event row
   * @throws DatabaseError if insert fails
   */
  create(event: CreateEventDto, createdBy: string): Promise<EventRow>;

  /**
   * Find an event by its ID.
   *
   * @param id - UUID of the event
   * @returns The event row or null if not found
   */
  findById(id: string): Promise<EventRow | null>;

  /**
   * Find an event by ID with related facility data.
   *
   * @param id - UUID of the event
   * @returns The event DTO with expanded relations or null
   */
  findByIdWithFacility(id: string): Promise<EventDto | null>;

  /**
   * Check if a facility exists and is operational.
   *
   * @param facilityId - UUID of the facility
   * @returns True if facility exists and is operational
   */
  facilityExists(facilityId: string): Promise<boolean>;

  /**
   * Delete multiple events by their IDs.
   *
   * @param ids - Array of event UUIDs
   * @returns Number of rows deleted
   */
  deleteManyByIds(ids: string[]): Promise<number>;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Service interface for Event business operations.
 *
 * @remarks
 * - Orchestrates validation, business rules, and persistence
 * - Returns DTOs ready for API response
 * - Throws domain-specific errors for business rule violations
 */
export interface IEventService {
  /**
   * Create a new event with full validation.
   *
   * @param dto - Event creation data from the frontend
   * @param createdBy - UUID of the authenticated user
   * @returns Created event DTO ready for API response
   *
   * @throws ValidationError if input data is invalid
   * @throws NotFoundError if facility doesn't exist
   * @throws BusinessRuleError if business rules are violated
   *
   * @remarks
   * Validation performed:
   * - Title is non-empty
   * - Date range is valid (end >= start)
   * - Facility exists if provided
   * - Audience config has at least one include rule
   * - Session config has at least one session per date
   */
  createEvent(dto: CreateEventDto, createdBy: string): Promise<EventDto>;

  /**
   * Validate event creation input without persisting.
   *
   * @param dto - Raw input data (may be partial/invalid)
   * @returns Validation result with sanitized data if valid
   *
   * @remarks
   * Frontend can use this for pre-submit validation.
   */
  validateCreateEvent(dto: unknown): ValidationResult<CreateEventDto>;

  /**
   * Delete one or more events by ID.
   *
   * @param ids - Array of event UUIDs to delete
   * @returns Number of events deleted
   */
  deleteEvents(ids: string[]): Promise<number>;
}
