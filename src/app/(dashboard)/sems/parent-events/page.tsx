"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, Users, Filter, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/shared/hooks/useAuth";

type EventStatus = "live" | "scheduled" | "completed";

type EventLifecycleStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "published"
  | "completed"
  | "cancelled";

type EventVisibility = "internal" | "student" | "public";

type SessionPeriod = "morning" | "afternoon" | "evening";
type SessionDirection = "in" | "out";

type ChildSessionStatus = "none" | "present" | "late";

interface ParentEventChildSession {
  sessionId: string;
  period: SessionPeriod;
  direction: SessionDirection;
  scheduledOpens: string | null;
  scheduledCloses: string | null;
  scannedAt: string | null;
  status: ChildSessionStatus;
}

interface ParentEventChild {
  studentId: string;
  fullName: string;
  gradeLevel: string | null;
  section: string | null;
  sessions: ParentEventChildSession[];
}

interface ParentEventListItem {
  id: string;
  title: string;
  timeRange: string;
  venue: string | null;
  audienceSummary: string;
  scannerSummary: string;
  actualAttendees: number;
  expectedAttendees: number;
  status: EventStatus;
  startDate: string;
  endDate: string;
  lifecycleStatus: EventLifecycleStatus;
  visibility: EventVisibility;
  facilityImageUrl?: string | null;
  children?: ParentEventChild[];
}

interface EventListResponseDto {
  events: ParentEventListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

type FilterTab = "all" | "upcoming" | "live" | "past";

function shouldRedirectToLogin(response: Response): boolean {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return true;
  }
  return false;
}

function formatEventDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "";
  if (startDate === endDate) {
    return new Date(startDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const start = new Date(startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(endDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${start} ႓ ${end}`;
}

function getStatusBadgeConfig(status: EventStatus): { label: string; className: string } {
  switch (status) {
    case "live":
      return {
        label: "Live now",
        className:
          "bg-emerald-500/10 text-emerald-700 border-emerald-500/40 dark:text-emerald-200",
      };
    case "scheduled":
      return {
        label: "Upcoming",
        className: "bg-sky-500/10 text-sky-700 border-sky-500/40 dark:text-sky-200",
      };
    case "completed":
    default:
      return {
        label: "Completed",
        className:
          "bg-slate-500/10 text-slate-700 border-slate-500/40 dark:text-slate-200",
      };
  }
}

function formatScanTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatChildSessionLabel(session?: ParentEventChildSession): string {
  if (!session || session.status === "none") {
    return "No scan";
  }

  const base = session.status === "present" ? "Present" : "Late";
  const time = formatScanTime(session.scannedAt);
  return time ? `${base} • ${time}` : base;
}

function getStatusAccentClass(status: EventStatus): string {
  switch (status) {
    case "live":
      return "bg-gradient-to-b from-emerald-400 to-emerald-600";
    case "scheduled":
      return "bg-gradient-to-b from-sky-400 to-sky-600";
    case "completed":
    default:
      return "bg-gradient-to-b from-slate-400 to-slate-600";
  }
}

export default function ParentEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<ParentEventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);

  const isParent = useMemo(() => {
    return (user?.roles ?? []).includes("PARENT");
  }, [user?.roles]);

  useEffect(() => {
    if (authLoading || !isParent) return;

    let isCancelled = false;

    async function loadEvents() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "50");

        const response = await fetch(`/api/sems/events/parent?${params.toString()}`, {
          method: "GET",
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: EventListResponseDto;
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !body?.success || !body.data) {
          const message = body?.error?.message ?? "Unable to load events.";
          throw new Error(message);
        }

        const publishedEvents = body.data.events.filter((event) =>
          ["published", "completed"].includes(event.lifecycleStatus)
        );

        if (!isCancelled) {
          setEvents(publishedEvents);
        }
      } catch (err) {
        if (!isCancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to load events. Please try again.";
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, isParent]);

  const stats = useMemo(() => {
    const total = events.length;
    const live = events.filter((e) => e.status === "live").length;
    const upcoming = events.filter((e) => e.status === "scheduled").length;
    const past = events.filter((e) => e.status === "completed").length;
    return { total, live, upcoming, past };
  }, [events]);

  const filteredEvents = useMemo(() => {
    let list = [...events];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((event) => {
        const titleMatch = event.title.toLowerCase().includes(q);
        const venueMatch = (event.venue ?? "").toLowerCase().includes(q);
        const audienceMatch = event.audienceSummary.toLowerCase().includes(q);
        return titleMatch || venueMatch || audienceMatch;
      });
    }

    if (filter === "live") {
      list = list.filter((event) => event.status === "live");
    } else if (filter === "upcoming") {
      list = list.filter((event) => event.status === "scheduled");
    } else if (filter === "past") {
      list = list.filter((event) => event.status === "completed");
    }

    list.sort((a, b) => a.startDate.localeCompare(b.startDate));

    return list;
  }, [events, filter, searchTerm]);

  const showUnauthorized = !authLoading && !isParent;

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-b from-background via-background to-muted/40">
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full px-4"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="relative w-full overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.url}
                alt={previewImage.alt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setPreviewImage(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-50 text-foreground shadow-lg dark:from-[#1B4D3E] dark:via-[#163e32] dark:to-[#111827] dark:text-white">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_#a7f3d0,_transparent_55%),_radial-gradient(circle_at_bottom,_#bfdbfe,_transparent_55%)] dark:opacity-25 dark:bg-[radial-gradient(circle_at_top,_#38bdf8,_transparent_55%),_radial-gradient(circle_at_bottom,_#22c55e,_transparent_55%)]" />
          <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3 py-1 text-xs font-medium text-emerald-900 backdrop-blur dark:bg-white/10 dark:text-emerald-100">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-300" />
                <span>Parent Event Hub</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Events that matter to your child.
                </h1>
                <p className="text-sm sm:text-base text-emerald-900/80 dark:text-emerald-100/90">
                  See school events your child is part of, stay updated when they go live, and keep
                  track of what is happening on campus.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-emerald-900 border border-emerald-100 shadow-sm dark:bg-black/15 dark:text-emerald-50 dark:border-transparent dark:shadow-none">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-200" />
                  <span>{stats.upcoming} upcoming event{stats.upcoming === 1 ? "" : "s"}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-emerald-900 border border-emerald-100 shadow-sm dark:bg-black/15 dark:text-emerald-50 dark:border-transparent dark:shadow-none">
                  <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-200" />
                  <span>{stats.total} total event{stats.total === 1 ? "" : "s"}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-emerald-900 border border-emerald-100 shadow-sm dark:bg-black/15 dark:text-emerald-50 dark:border-transparent dark:shadow-none">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-200" />
                  <span>{stats.live} live now</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex flex-col gap-3 rounded-2xl bg-white/90 px-4 py-4 min-w-[220px] border border-emerald-100 text-emerald-900 shadow-sm dark:bg-black/10 dark:border-white/10 dark:text-emerald-100 dark:shadow-none">
              <div className="flex items-center justify-between text-xs text-emerald-900/80 dark:text-emerald-100">
                <span>Feed filters</span>
                <Filter className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1 text-xs text-emerald-800 dark:text-emerald-100">
                <p className="text-emerald-900 font-medium dark:text-emerald-50">Events are curated around your child.</p>
                <p className="text-emerald-700/80 dark:text-emerald-100/80">
                  Only published events where your child is part of the audience will appear here.
                </p>
              </div>
            </div>
          </div>
        </section>

        {showUnauthorized && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
            <AlertTitle className="text-sm">Parent access only</AlertTitle>
            <AlertDescription className="text-xs">
              This page is for parent accounts. Sign in as a parent to see events linked to your
              child.
            </AlertDescription>
          </Alert>
        )}

        {!showUnauthorized && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground/70">
                    <Filter className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    placeholder="Search by event name, venue, or audience..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-9 text-sm bg-card border-border focus-visible:ring-[#1B4D3E]/20"
                  />
                </div>
              </div>
              <div className="inline-flex rounded-full bg-card border border-border p-1 text-xs">
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "all" ? "default" : "ghost"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "upcoming" ? "default" : "ghost"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setFilter("upcoming")}
                >
                  Upcoming
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "live" ? "default" : "ghost"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setFilter("live")}
                >
                  Live now
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "past" ? "default" : "ghost"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setFilter("past")}
                >
                  Past
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading events...</span>
              </div>
            )}

            {!isLoading && error && (
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                <AlertTitle className="text-sm">Unable to load events</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {!isLoading && !error && filteredEvents.length === 0 && (
              <Card className="border-dashed border-border bg-muted/40">
                <CardContent className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border mb-1">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">No events to show yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      When the school publishes events that include your child in the audience,
                      they will appear here automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && !error && filteredEvents.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredEvents.map((event) => {
                  const statusBadge = getStatusBadgeConfig(event.status);
                  const accentClass = getStatusAccentClass(event.status);
                  const dateRange = formatEventDateRange(event.startDate, event.endDate);
                  const children = event.children ?? [];
                  const hasChildren = children.length > 0;

                  const progressRatio =
                    event.expectedAttendees > 0
                      ? Math.min(1, event.actualAttendees / event.expectedAttendees)
                      : 0;

                  return (
                    <Card
                      key={event.id}
                      className="relative overflow-hidden border-border/70 bg-card/95 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
                    >
                      <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl" style={{}}>
                        <div className={`h-full w-full ${accentClass}`} />
                      </div>
                      <CardHeader className="pb-3 pt-4 flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1.5 pr-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`h-5 px-2 text-[11px] font-medium border ${statusBadge.className}`}
                            >
                              {statusBadge.label}
                            </Badge>
                            {event.visibility === "public" && (
                              <Badge
                                variant="outline"
                                className="h-5 px-2 text-[11px] font-medium border-sky-500/40 bg-sky-500/5 text-sky-700"
                              >
                                Public
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
                            {event.title}
                          </CardTitle>
                          <CardDescription className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>{dateRange}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{event.timeRange}</span>
                            </span>
                          </CardDescription>
                        </div>
                        {event.facilityImageUrl && (
                          <div className="flex-shrink-0">
                            <button
                              type="button"
                              className="relative h-16 w-24 rounded-lg overflow-hidden border border-border/70 bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
                              onClick={() =>
                                setPreviewImage({
                                  url: event.facilityImageUrl ?? "",
                                  alt: event.venue ?? event.title,
                                })
                              }
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={event.facilityImageUrl}
                                alt={event.venue ?? "Event venue"}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="pb-4 pt-0 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-2 text-xs">
                          <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{event.venue || "Venue to be announced"}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span className="line-clamp-1">
                              {event.audienceSummary || "Target audience not specified"}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Attendance</span>
                            <span>
                              {event.actualAttendees} / {event.expectedAttendees || "?"} students
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 transition-all"
                              style={{ width: `${progressRatio * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                            <span>
                              Attendance for your child{hasChildren && children.length > 1 ? "ren" : ""}
                            </span>
                          </div>
                          {!hasChildren && (
                            <p className="text-[11px] text-muted-foreground">
                              No linked children for this event yet.
                            </p>
                          )}
                          {hasChildren && (
                            <div className="space-y-2">
                              {children.map((child) => {
                                const sessions = [...child.sessions].sort((a, b) => {
                                  const periodOrder: Record<SessionPeriod, number> = {
                                    morning: 0,
                                    afternoon: 1,
                                    evening: 2,
                                  };

                                  const directionOrder: Record<SessionDirection, number> = {
                                    in: 0,
                                    out: 1,
                                  };

                                  const byPeriod = periodOrder[a.period] - periodOrder[b.period];
                                  if (byPeriod !== 0) return byPeriod;
                                  return directionOrder[a.direction] - directionOrder[b.direction];
                                });

                                const formatSessionLabel = (session: ParentEventChildSession): string => {
                                  const periodLabel =
                                    session.period === "morning"
                                      ? "Morning"
                                      : session.period === "afternoon"
                                      ? "Afternoon"
                                      : "Evening";
                                  const directionLabel = session.direction === "in" ? "In" : "Out";
                                  return `${periodLabel} ${directionLabel}`;
                                };

                                return (
                                  <div
                                    key={child.studentId}
                                    className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">
                                          {child.fullName}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                          {[child.gradeLevel, child.section].filter(Boolean).join(" • ") || "Student"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-1 space-y-1 text-[10px] text-muted-foreground">
                                      {sessions.map((session) => (
                                        <div
                                          key={session.sessionId}
                                          className="flex items-center justify-between gap-2"
                                        >
                                          <span className="font-medium">
                                            {formatSessionLabel(session)}
                                          </span>
                                          <span className="text-right">
                                            {formatChildSessionLabel(session)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
