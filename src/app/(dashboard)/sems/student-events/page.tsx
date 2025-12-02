"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, Users, Filter, Loader2, Sparkles, Facebook } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type StudentSessionStatus = "none" | "present" | "late";

interface StudentEventSession {
  sessionId: string;
  period: SessionPeriod;
  direction: SessionDirection;
  scheduledOpens: string | null;
  scheduledCloses: string | null;
  scannedAt: string | null;
  status: StudentSessionStatus;
}

interface StudentEventListItem {
  id: string;
  title: string;
  timeRange: string;
  venue: string | null;
  description: string | null;
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
  mySessions?: StudentEventSession[];
  posterImageUrl?: string | null;
}

interface EventListResponseDto {
  events: StudentEventListItem[];
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

  return `${start} – ${end}`;
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

function getStatusAccentClass(status: EventStatus): string {
  switch (status) {
    case "live":
      return "bg-gradient-to-br from-emerald-50/90 via-white to-emerald-100/90 dark:from-emerald-900 dark:via-slate-950 dark:to-emerald-950";
    case "scheduled":
      return "bg-gradient-to-br from-sky-50/90 via-white to-sky-100/90 dark:from-sky-900 dark:via-slate-950 dark:to-sky-950";
    case "completed":
    default:
      return "bg-gradient-to-br from-slate-50/90 via-white to-slate-100/90 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900";
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

function formatStudentSessionLabel(session: StudentEventSession): string {
  const periodLabel =
    session.period === "morning"
      ? "Morning"
      : session.period === "afternoon"
      ? "Afternoon"
      : "Evening";
  const directionLabel = session.direction === "in" ? "In" : "Out";
  return `${periodLabel} ${directionLabel}`;
}

function formatStudentSessionStatus(session: StudentEventSession): string {
  if (session.status === "none") {
    return "No scan";
  }

  const base = session.status === "present" ? "Present" : "Late";
  const time = formatScanTime(session.scannedAt);
  return time ? `${base} • ${time}` : base;
}

export default function StudentEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<StudentEventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);
  const [shareEvent, setShareEvent] = useState<StudentEventListItem | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const isStudent = useMemo(() => {
    return (user?.roles ?? []).includes("STUDENT");
  }, [user?.roles]);

  useEffect(() => {
    if (authLoading || !isStudent) return;

    let isCancelled = false;

    async function loadEvents() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "50");

        const response = await fetch(`/api/sems/events/student?${params.toString()}`, {
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
          const message = body?.error?.message ?? "Unable to load your events.";
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
            err instanceof Error ? err.message : "Unable to load your events. Please try again.";
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
  }, [authLoading, isStudent]);

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

  const showUnauthorized = !authLoading && !isStudent;

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
      <Dialog
        open={isShareDialogOpen && !!shareEvent}
        onOpenChange={(open) => {
          setIsShareDialogOpen(open);
          if (!open) {
            setShareEvent(null);
            setShareMessage("");
          }
        }}
     >
        {shareEvent && (
          <DialogContent className="w-[calc(100%-2rem)] max-w-xl sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto border-emerald-100/60 bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950">
            <DialogHeader className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#1877F2]/10 px-3 py-1 text-xs font-medium text-[#1877F2] dark:bg-[#1877F2]/20 dark:text-[#E5F0FF]">
                <Facebook className="h-3.5 w-3.5" />
                <span>Share to Facebook</span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
                Preview your post
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                This is what your friends will see when you share this event. Add a personal message,
                then copy your caption and paste it into Facebook after you continue.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start">
              <div className="space-y-3 rounded-xl border border-emerald-100/70 bg-white/70 p-3 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900/60">
                <div className="overflow-hidden rounded-lg border border-emerald-100/80 bg-muted/40 dark:border-slate-800 dark:bg-slate-900">
                  <div className="relative w-full aspect-[16/9]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shareEvent.posterImageUrl ?? shareEvent.facilityImageUrl ?? ""}
                      alt={shareEvent.venue ?? shareEvent.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200">
                    {shareEvent.visibility === "public" ? "Public event" : "Green Valley Foundation College Inc."}
                  </p>
                  <p className="line-clamp-2 text-sm font-semibold text-foreground dark:text-emerald-50">
                    {shareEvent.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {shareEvent.description || "This event uses your school event description as the Facebook caption."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      <span>{formatEventDateRange(shareEvent.startDate, shareEvent.endDate)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{shareEvent.timeRange}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      <span>{shareEvent.venue || "Venue to be announced"}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Add a personal message</p>
                  <p className="text-[11px] text-muted-foreground">
                    This will appear at the top of your Facebook post, above the event card.
                  </p>
                </div>
                <textarea
                  value={shareMessage}
                  onChange={(event) => setShareMessage(event.target.value)}
                  placeholder="Tell your friends why they should join this event..."
                  className="w-full min-h-[96px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2 dark:bg-slate-900"
                />
                <div className="rounded-lg border border-dashed border-emerald-200/70 bg-emerald-50/50 px-3 py-2 text-[11px] text-emerald-900/90 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-100">
                  Your school event description and poster image are automatically included in the
                  shared card.
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setIsShareDialogOpen(false);
                  setShareEvent(null);
                  setShareMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs"
                onClick={async () => {
                  if (!shareEvent) return;
                  if (typeof window === "undefined") return;

                  const pieces: string[] = [];
                  pieces.push(shareEvent.title);
                  if (shareEvent.venue) {
                    pieces.push(`@ ${shareEvent.venue}`);
                  }
                  if (shareEvent.timeRange) {
                    pieces.push(`• ${shareEvent.timeRange}`);
                  }
                  if (shareEvent.description) {
                    pieces.push(shareEvent.description);
                  }

                  const previewText = pieces.join(" \u2013 ");
                  const fullQuote = shareMessage.trim()
                    ? `${shareMessage.trim()}\n\n${previewText}`
                    : previewText;

                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(fullQuote);
                    } else {
                      const textarea = document.createElement("textarea");
                      textarea.value = fullQuote;
                      textarea.style.position = "fixed";
                      textarea.style.left = "-9999px";
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand("copy");
                      document.body.removeChild(textarea);
                    }

                    toast.success("Caption copied", {
                      description: "Paste it into Facebook before you post.",
                    });
                  } catch (error) {
                    toast.error("Unable to copy caption", {
                      description: "You can still select and copy the text manually.",
                    });
                  }
                }}
              >
                Copy caption
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#1877F2] text-xs font-medium text-white hover:bg-[#145DBF]"
                onClick={() => {
                  if (!shareEvent) return;
                  if (typeof window === "undefined") return;

                  const baseUrl = window.location.origin;
                  const eventUrl = `${baseUrl}/events/${shareEvent.id}`;
                  const pieces: string[] = [];
                  pieces.push(shareEvent.title);
                  if (shareEvent.venue) {
                    pieces.push(`@ ${shareEvent.venue}`);
                  }
                  if (shareEvent.timeRange) {
                    pieces.push(`• ${shareEvent.timeRange}`);
                  }
                  if (shareEvent.description) {
                    pieces.push(shareEvent.description);
                  }

                  const previewText = pieces.join(" \u2013 ");
                  const fullQuote = shareMessage.trim()
                    ? `${shareMessage.trim()}\n\n${previewText}`
                    : previewText;

                  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    eventUrl
                  )}&quote=${encodeURIComponent(fullQuote)}`;

                  window.open(fbUrl, "_blank", "noopener,noreferrer");
                }}
              >
                Continue to Facebook
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-50 text-foreground shadow-lg dark:from-[#1B4D3E] dark:via-[#163e32] dark:to-[#111827] dark:text-white">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_#a7f3d0,_transparent_55%),_radial-gradient(circle_at_bottom,_#bfdbfe,_transparent_55%)] dark:opacity-25 dark:bg-[radial-gradient(circle_at_top,_#38bdf8,_transparent_55%),_radial-gradient(circle_at_bottom,_#22c55e,_transparent_55%)]" />
          <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3 py-1 text-xs font-medium text-emerald-900 backdrop-blur dark:bg-white/10 dark:text-emerald-100">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-300" />
                <span>Student Event Hub</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Your school events, in one place.
                </h1>
                <p className="text-sm sm:text-base text-emerald-900/80 dark:text-emerald-100/90">
                  See the events you are part of, stay updated when they go live, and never miss
                  what is happening on campus.
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
                <p className="text-emerald-900 font-medium dark:text-emerald-50">Events are curated just for you.</p>
                <p className="text-emerald-700/80 dark:text-emerald-100/80">
                  Only published events where you are part of the audience will appear here.
                </p>
              </div>
            </div>
          </div>
        </section>

        {showUnauthorized && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
            <AlertTitle className="text-sm">Student access only</AlertTitle>
            <AlertDescription className="text-xs">
              This page is for student accounts. Sign in as a student to see your events.
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
                <span className="text-sm">Loading your events...</span>
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
                      When your school publishes events that include you in the audience, they will
                      appear here automatically.
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
                  const mySessions = event.mySessions ?? [];

                  const progressRatio =
                    event.expectedAttendees > 0
                      ? Math.min(1, event.actualAttendees / event.expectedAttendees)
                      : 0;

                  return (
                    <Card
                      key={event.id}
                      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-50/80 shadow-[0_10px_30px_rgba(15,118,110,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,118,110,0.18)] dark:border-emerald-900/60 ${accentClass}`}
                    >
                      <CardHeader className="pb-2 pt-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <Badge
                                variant="outline"
                                className={`h-5 px-2 font-medium border backdrop-blur-sm ${statusBadge.className}`}
                              >
                                {statusBadge.label}
                              </Badge>
                              {event.visibility === "public" && (
                                <Badge
                                  variant="outline"
                                  className="h-5 px-2 font-medium border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-100"
                                >
                                  Public
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
                              {event.title}
                            </CardTitle>
                            <CardDescription className="text-[11px] flex flex-wrap gap-x-3 gap-y-1 text-emerald-900/80 dark:text-emerald-100/80">
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
                          <div className="flex flex-col items-end gap-2">
                            {(event.posterImageUrl || event.facilityImageUrl) && (
                              <button
                                type="button"
                                className="relative h-16 w-24 overflow-hidden rounded-xl border border-emerald-100/70 bg-emerald-50/60 shadow-sm ring-offset-background transition hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-emerald-900/60 dark:bg-slate-900"
                                onClick={() =>
                                  setPreviewImage({
                                    url: event.posterImageUrl ?? event.facilityImageUrl ?? "",
                                    alt: event.venue ?? event.title,
                                  })
                                }
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={event.posterImageUrl ?? event.facilityImageUrl ?? ""}
                                  alt={event.venue ?? event.title}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-sm ring-offset-background transition hover:-translate-y-0.5 hover:bg-[#145DBF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2"
                              onClick={() => {
                                setShareEvent(event);
                                setShareMessage("");
                                setIsShareDialogOpen(true);
                              }}
                            >
                              <span className="sr-only">Share on Facebook</span>
                              <Facebook className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4 pt-1 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-2 text-xs">
                          {event.description && (
                            <p className="line-clamp-2 text-foreground/80 dark:text-emerald-50/90">
                              {event.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{event.venue || "Venue to be announced"}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              <span className="line-clamp-1">
                                {event.audienceSummary || "Target audience not specified"}
                              </span>
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
                          <div className="h-1.5 w-full rounded-full bg-emerald-100/60 dark:bg-emerald-900/40 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-500 transition-all"
                              style={{ width: `${progressRatio * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-1 space-y-2 border-t border-emerald-100/80 pt-2 text-[11px] text-muted-foreground dark:border-emerald-900/60">
                          <p>
                            Scan data is not real time. Your scans will appear here after the scanner
                            submits its data.
                          </p>
                          {mySessions.length > 0 && (
                            <div className="mt-1 space-y-1.5 text-[10px] text-muted-foreground">
                              {[...mySessions]
                                .sort((a, b) => {
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
                                })
                                .map((session) => (
                                  <div
                                    key={session.sessionId}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="font-medium">
                                      {formatStudentSessionLabel(session)}
                                    </span>
                                    <span className="text-right">
                                      {formatStudentSessionStatus(session)}
                                    </span>
                                  </div>
                                ))}
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
