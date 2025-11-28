"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Calendar as CalendarIcon, MapPin, Users, MoreHorizontal, Download, Upload, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { scannerDb } from "@/core/offline/scanner-db";
import { toast } from "sonner";

interface ScannerEventItem {
  id: string;
  title: string;
  date: string;
  timeRange: string;
  venue: string;
  role: string;
  status: "live" | "upcoming" | "completed";
  expectedAttendees: number;
  checkedIn: number;
  startDate: string;
}

type ApiEventStatus = "live" | "scheduled" | "completed";

interface ApiEventListItemDto {
  id: string;
  title: string;
  timeRange: string;
  venue: string | null;
  actualAttendees: number;
  expectedAttendees: number;
  status: ApiEventStatus;
  startDate: string;
  endDate: string;
}

function mapApiStatusToScannerStatus(status: ApiEventStatus): ScannerEventItem["status"] {
  if (status === "live") return "live";
  if (status === "completed") return "completed";
  return "upcoming";
}

function formatDateLabel(startDate: string): string {
  if (!startDate) return "—";

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  if (startDate === todayIso) return "Today";
  if (startDate === tomorrowIso) return "Tomorrow";

  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) {
    return startDate;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ScannerEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<ScannerEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [downloadingEventId, setDownloadingEventId] = useState<string | null>(null);
  const [uploadingEventId, setUploadingEventId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "50");

      const trimmedSearch = appliedSearch.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/sems/events/scanner?${params.toString()}`);

      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // ignore JSON parse errors; will handle via status
      }

      if (!response.ok) {
        const message =
          body?.error?.message ??
          `Failed to load scanner events (status ${response.status}).`;
        throw new Error(message);
      }

      const apiEvents = (body?.data?.events ?? []) as ApiEventListItemDto[];

      const mappedEvents: ScannerEventItem[] = apiEvents.map((event) => {
        const status = mapApiStatusToScannerStatus(event.status);
        const startDate = event.startDate ?? "";

        return {
          id: event.id,
          title: event.title,
          date: formatDateLabel(startDate),
          timeRange: event.timeRange,
          venue: event.venue ?? "TBA",
          role: "Scanner",
          status,
          expectedAttendees: event.expectedAttendees ?? 0,
          checkedIn: event.actualAttendees ?? 0,
          startDate,
        };
      });

      setEvents(mappedEvents);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load scanner events.";
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const stats = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

    let live = 0;
    let upcoming = 0;
    let completed = 0;
    let today = 0;
    let totalCheckIns = 0;

    for (const event of events) {
      totalCheckIns += event.checkedIn;

      if (event.startDate === todayIso) {
        today += 1;
      }

      if (event.status === "live") {
        live += 1;
      } else if (event.status === "completed") {
        completed += 1;
      } else {
        upcoming += 1;
      }
    }

    return {
      total: events.length,
      live,
      upcoming,
      completed,
      today,
      totalCheckIns,
    };
  }, [events]);

  const handleDownloadEventData = useCallback(
    async (eventItem: ScannerEventItem) => {
      setDownloadingEventId(eventItem.id);

      try {
        const response = await fetch(`/api/sems/events/${eventItem.id}/scanner-resources`);

        let body: any = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (!response.ok || body?.success === false) {
          const message =
            body?.error?.message ??
            `Failed to download scanner data (status ${response.status}).`;
          toast.error(message);
          return;
        }

        const payload = body?.data ?? body;
        const apiEvent = payload?.event;
        const students = (payload?.students ?? []) as any[];

        if (!apiEvent || !Array.isArray(students)) {
          toast.error("Invalid scanner data received from server.");
          return;
        }

        const nowIso = new Date().toISOString();

        await scannerDb.transaction(
          "rw",
          scannerDb.scannerEvents,
          scannerDb.allowedStudents,
          async () => {
            await scannerDb.scannerEvents.put({
              id: apiEvent.id,
              title: apiEvent.title,
              venue: apiEvent.facilityName ?? eventItem.venue ?? null,
              timeRange: eventItem.timeRange,
              startDate: apiEvent.startDate,
              endDate: apiEvent.endDate,
              sessionConfig: apiEvent.sessionConfig,
              scannerUserId: "current",
              downloadedAt: nowIso,
            });

            await scannerDb.allowedStudents.where("eventId").equals(apiEvent.id).delete();

            const rows = students.map((student) => ({
              eventId: apiEvent.id,
              studentId: student.id,
              qrHash: student.qrHash ?? student.qr_hash,
              fullName: student.fullName ?? `${(student.firstName ?? "").trim()} ${(student.lastName ?? "").trim()}`.trim(),
              lrn: student.lrn ?? "",
              grade: student.levelName ?? "",
              section: student.sectionName ?? "",
            }));

            if (rows.length > 0) {
              await scannerDb.allowedStudents.bulkAdd(rows);
            }
          }
        );

        toast.success("Scanner data downloaded", {
          description: `${students.length.toLocaleString()} students cached for ${eventItem.title}.`,
        });
      } catch (downloadError) {
        // eslint-disable-next-line no-console
        console.error("[ScannerEventsPage] Failed to download scanner data", downloadError);
        toast.error("Unable to download scanner data. Please try again.");
      } finally {
        setDownloadingEventId(null);
      }
    },
    []
  );

  const handleUploadEventData = useCallback(
    async (eventItem: ScannerEventItem) => {
      setUploadingEventId(eventItem.id);

      try {
        // Get pending scans from IndexedDB for this event
        const pendingScans = await scannerDb.scanQueue
          .where("eventId")
          .equals(eventItem.id)
          .and((scan) => scan.syncStatus === "pending")
          .toArray();

        if (pendingScans.length === 0) {
          toast.info("No pending scans", {
            description: "All scans for this event have already been uploaded.",
          });
          return;
        }

        // Get the cached event to retrieve session config for enriching scans
        const cachedEvent = await scannerDb.scannerEvents.get(eventItem.id);
        const sessionConfig = cachedEvent?.sessionConfig;

        // Build session lookup map from sessionConfig
        const sessionMap = new Map<string, {
          period: string;
          opens: string;
          closes: string;
          lateAfter: string | null;
        }>();

        if (sessionConfig?.dates) {
          for (const dateConfig of sessionConfig.dates) {
            for (const session of dateConfig.sessions ?? []) {
              sessionMap.set(session.id, {
                period: session.period,
                opens: session.opens,
                closes: session.closes,
                lateAfter: session.lateAfter,
              });
            }
          }
        }

        // Prepare scans for upload with enriched session info
        const scansToUpload = pendingScans.map((scan) => {
          const sessionInfo = scan.sessionId ? sessionMap.get(scan.sessionId) : null;
          return {
            id: scan.id,
            studentId: scan.studentId,
            qrHash: scan.qrHash,
            scannedAt: scan.scannedAt,
            status: scan.status,
            reason: scan.reason,
            sessionId: scan.sessionId,
            sessionName: scan.sessionName,
            sessionDirection: scan.sessionDirection,
            sessionPeriod: sessionInfo?.period ?? null,
            sessionOpens: sessionInfo?.opens ?? null,
            sessionCloses: sessionInfo?.closes ?? null,
            sessionLateAfter: sessionInfo?.lateAfter ?? null,
          };
        });

        // Upload to server
        const response = await fetch(`/api/sems/events/${eventItem.id}/scans`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scans: scansToUpload }),
        });

        let body: any = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (!response.ok || body?.success === false) {
          const message =
            body?.error?.message ??
            `Failed to upload scan data (status ${response.status}).`;
          toast.error(message);
          return;
        }

        const result = body?.data ?? body;
        const uploadedIds = (result?.uploadedScanIds ?? []) as string[];

        // Mark uploaded scans as synced in IndexedDB
        if (uploadedIds.length > 0) {
          await scannerDb.transaction("rw", scannerDb.scanQueue, async () => {
            for (const scanId of uploadedIds) {
              await scannerDb.scanQueue.update(scanId, { syncStatus: "synced" });
            }
          });
        }

        // Show success message
        const uploaded = result?.uploaded ?? 0;
        const duplicates = result?.duplicates ?? 0;
        const skipped = result?.skipped ?? 0;

        toast.success("Scans uploaded", {
          description: `${uploaded} uploaded, ${duplicates} duplicates, ${skipped} skipped.`,
        });

        // Refresh the events list to show updated attendance
        void loadEvents();
      } catch (uploadError) {
        // eslint-disable-next-line no-console
        console.error("[ScannerEventsPage] Failed to upload scan data", uploadError);
        toast.error("Unable to upload scan data. Please try again.");
      } finally {
        setUploadingEventId(null);
      }
    },
    [loadEvents]
  );

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">
              Scanner Events
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              View events where you are registered as a scanner. This is a scanner-focused view
              so you can quickly see what you need to scan today and what&apos;s coming up next.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 bg-gradient-to-br from-emerald-500/10 via-card to-muted/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                Today&apos;s scanner events
              </p>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {stats.today}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Events assigned to you today
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100/10 text-emerald-300 border border-emerald-500/40">
              <QrCode className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 border-t-4 border-t-sky-500 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 bg-gradient-to-br from-sky-500/10 via-card to-muted/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live check-ins
              </p>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {stats.totalCheckIns.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Across your live events
              </p>
            </div>
            <div className="p-3 rounded-xl bg-sky-100/10 text-sky-300 border border-sky-500/40">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 border-t-4 border-t-amber-500 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 bg-gradient-to-br from-amber-500/10 via-card to-muted/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Upcoming assignments
              </p>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {stats.upcoming}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Later today and tomorrow
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100/10 text-amber-300 border border-amber-500/40">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 border-t-4 border-t-violet-500 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 bg-gradient-to-br from-violet-500/10 via-card to-muted/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total scanner events
              </p>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {stats.total}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Where you are assigned as scanner
              </p>
            </div>
            <div className="p-3 rounded-xl bg-violet-100/10 text-violet-300 border border-violet-500/40">
              <CalendarIcon className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Events you will scan
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              These are events where you are configured as a scanner. Use search to quickly find a
              specific assignment.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Input
              type="search"
              placeholder="Search events by title or venue..."
              className="h-9 w-full sm:w-64 bg-card"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setAppliedSearch(searchInput);
                }
              }}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
              >
                {stats.live} live
              </Badge>
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-300 border-blue-500/40"
              >
                {stats.upcoming} upcoming
              </Badge>
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground border-border/60"
              >
                {stats.completed} completed
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
          <div className="mt-3 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="max-h-[480px] overflow-y-auto p-4">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow className="border-border">
                    <TableHead className="w-[40%] text-xs font-semibold text-muted-foreground">
                      Event
                    </TableHead>
                    <TableHead className="w-[20%] text-xs font-semibold text-muted-foreground">
                      Schedule
                    </TableHead>
                    <TableHead className="w-[20%] text-xs font-semibold text-muted-foreground">
                      Venue
                    </TableHead>
                    <TableHead className="w-[10%] text-xs font-semibold text-muted-foreground text-right">
                      Attendance
                    </TableHead>
                    <TableHead className="w-[10%] text-xs font-semibold text-muted-foreground text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Loading scanner events...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && error && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-6 text-center text-sm text-red-400"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span>{error}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void loadEvents();
                            }}
                          >
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && !error && events.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No scanner events found yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    !error &&
                    events.map((event) => (
                    <TableRow
                      key={event.id}
                      onClick={() => router.push(`/sems/scan/${event.id}?autostart=1`)}
                      className="border-border hover:bg-emerald-500/5 cursor-pointer transition-colors"
                    >
                      <TableCell className="align-top py-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
                            <QrCode className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">
                              {event.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {event.date}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {event.expectedAttendees.toLocaleString()} expected
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-3 text-sm text-muted-foreground">
                        {event.timeRange}
                      </TableCell>
                      <TableCell className="align-top py-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground/70" />
                          {event.venue}
                        </span>
                      </TableCell>
                      <TableCell className="align-top py-3 text-right text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {event.checkedIn.toLocaleString()}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          / {event.expectedAttendees.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="align-top py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-44 rounded-lg border border-border bg-card shadow-lg"
                          >
                            <DropdownMenuItem
                              className="gap-2 text-sm text-muted-foreground cursor-pointer"
                              disabled={downloadingEventId === event.id}
                              onClick={(menuEvent) => {
                                menuEvent.stopPropagation();
                                void handleDownloadEventData(event);
                              }}
                            >
                              <Download className="h-4 w-4" />
                              Download data
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-sm text-gray-700 cursor-pointer"
                              disabled={uploadingEventId === event.id}
                              onClick={(menuEvent) => {
                                menuEvent.stopPropagation();
                                void handleUploadEventData(event);
                              }}
                            >
                              <Upload className="h-4 w-4" />
                              {uploadingEventId === event.id ? "Uploading..." : "Upload data"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
