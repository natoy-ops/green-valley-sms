/**
 * SEMS (School Event Management System) Module
 *
 * Public API for the SEMS module. Import from here rather than
 * reaching into internal layers directly.
 *
 * @example
 * ```ts
 * import { EventService, EventRepository, CreateEventDto } from "@/modules/sems";
 * ```
 */

// Domain types and interfaces
export * from "./domain";

// Application layer (services)
export * from "./application";

// Infrastructure layer (repositories)
export * from "./infrastructure";
