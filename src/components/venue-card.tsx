"use client";

import { cn } from "@/lib/utils";
import { Building2, MapPin, Users, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Venue availability status for display.
 */
export type VenueAvailabilityStatus = "available" | "partial" | "unavailable";

/**
 * Session conflict information.
 */
export interface SessionConflict {
  date: string;
  period: string;
  timeRange: string;
  conflictingEventTitle: string;
  conflictingEventId: string;
}

/**
 * Props for the VenueCard component.
 */
export interface VenueCardProps {
  /** Facility ID */
  facilityId: string;
  /** Facility name */
  name: string;
  /** Facility location */
  location: string;
  /** Image URL (optional) */
  imageUrl?: string | null;
  /** Capacity (optional) */
  capacity?: number | null;
  /** Availability status */
  status: VenueAvailabilityStatus;
  /** Conflict details */
  conflicts: SessionConflict[];
  /** Whether this venue is currently selected */
  isSelected: boolean;
  /** Callback when venue is clicked */
  onSelect: () => void;
  /** Whether selection is disabled */
  disabled?: boolean;
}

/**
 * VenueCard Component
 *
 * Displays a venue as a card in the selection grid with availability indicators.
 *
 * @remarks
 * Visual states:
 * - Available (green): Fully available for all requested sessions
 * - Partial (yellow): Some sessions have conflicts
 * - Unavailable (red): All sessions have conflicts, not selectable
 * - Selected: Highlighted border when chosen
 */
export function VenueCard({
  facilityId,
  name,
  location,
  imageUrl,
  capacity,
  status,
  conflicts,
  isSelected,
  onSelect,
  disabled = false,
}: VenueCardProps) {
  const isUnavailable = status === "unavailable";
  const isClickable = !disabled && !isUnavailable;

  // Status indicator colors and icons
  const statusConfig = {
    available: {
      bgColor: "bg-emerald-500/15",
      borderColor: "border-emerald-500/40",
      textColor: "text-emerald-200",
      icon: CheckCircle,
      label: "Available",
    },
    partial: {
      bgColor: "bg-amber-500/15",
      borderColor: "border-amber-500/40",
      textColor: "text-amber-200",
      icon: Clock,
      label: "Partial",
    },
    unavailable: {
      bgColor: "bg-red-500/15",
      borderColor: "border-red-500/40",
      textColor: "text-red-200",
      icon: AlertCircle,
      label: "Unavailable",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={isClickable ? onSelect : undefined}
          disabled={!isClickable}
          className={cn(
            "relative flex flex-col rounded-xl border overflow-hidden transition-all text-left w-full",
            // Base styles
            "bg-card shadow-sm hover:shadow-md",
            // Selected state
            isSelected && "border-[#1B4D3E] ring-2 ring-[#1B4D3E]",
            // Available state
            status === "available" && !isSelected && "border-emerald-500/40",
            // Partial state
            status === "partial" && !isSelected && "border-amber-500/40",
            // Unavailable state
            isUnavailable && "opacity-60 cursor-not-allowed border-red-500/40",
            // Clickable cursor
            isClickable && "cursor-pointer"
          )}
        >
          {/* Image or placeholder */}
          <div className="relative h-24 bg-muted overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                <Building2 className="w-10 h-10 text-muted-foreground/70" />
              </div>
            )}

            {/* Status badge overlay */}
            <div
              className={cn(
                "absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium",
                config.bgColor,
                config.textColor
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {config.label}
            </div>

            {/* Selected checkmark */}
            {isSelected && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-[#1B4D3E] rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3 space-y-1">
            <h4 className="font-medium text-sm text-foreground truncate">{name}</h4>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>

            {capacity && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3 flex-shrink-0" />
                <span>Capacity: {capacity}</span>
              </div>
            )}

            {/* Conflict summary for partial availability */}
            {status === "partial" && conflicts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/60">
                <p className="text-[10px] text-amber-300 font-medium">
                  {conflicts.length} session{conflicts.length !== 1 ? "s" : ""} conflicting
                </p>
              </div>
            )}
          </div>
        </button>
      </TooltipTrigger>

      {/* Tooltip with conflict details */}
      {conflicts.length > 0 && (
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium text-xs">Scheduling Conflicts:</p>
            <ul className="space-y-1">
              {conflicts.slice(0, 3).map((conflict, idx) => (
                <li key={idx} className="text-[11px] text-gray-600">
                  <span className="font-medium">{conflict.date}</span>
                  {" • "}
                  <span className="capitalize">{conflict.period}</span>
                  {" • "}
                  <span className="text-red-600">{conflict.conflictingEventTitle}</span>
                </li>
              ))}
              {conflicts.length > 3 && (
                <li className="text-[11px] text-gray-500 italic">
                  +{conflicts.length - 3} more conflicts
                </li>
              )}
            </ul>
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
