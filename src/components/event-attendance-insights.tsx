"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity, Users, Clock, CheckCircle2, Check, ChevronsUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { downloadExcelFile } from "@/lib/excel-utils";
import { toast } from "sonner";
import ExcelJS from "exceljs";

interface EventSummaryItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: "live" | "scheduled" | "completed";
}

type SessionPeriod = "morning" | "afternoon" | "evening";
type SessionDirection = "in" | "out";

type StudentSessionStatus = "none" | "present" | "late" | "no_scan";

interface SessionStatsDto {
  sessionId: string;
  name: string;
  sessionType: string;
  period: SessionPeriod;
  direction: SessionDirection;
  totalScans: number;
  present: number;
  late: number;
  absent: number;
  uniqueStudents: number;
}

interface PeriodStatsDto {
  period: SessionPeriod;
  inSession?: SessionStatsDto;
  outSession?: SessionStatsDto;
  missingOutCount?: number;
}

interface StudentAttendanceRowDto {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  gradeLevel: string | null;
  section: string | null;
  sessions: Record<string, StudentSessionStatus>;
}

interface EventAttendanceStatsDto {
  eventId: string;
  eventTitle: string;
  totalSessions: number;
  totalScans: number;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  uniqueStudents: number;
  periods: PeriodStatsDto[];
  students: StudentAttendanceRowDto[];
}

interface EventAttendanceInsightsProps {
  events: EventSummaryItem[];
}

export function EventAttendanceInsights({ events }: EventAttendanceInsightsProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [stats, setStats] = useState<EventAttendanceStatsDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const hasEvents = events.length > 0;

  // Pick a sensible default event when events change
  useEffect(() => {
    if (!hasEvents) {
      setSelectedEventId(null);
      setStats(null);
      return;
    }

    setSelectedEventId((current) => {
      if (current && events.some((e) => e.id === current)) {
        return current;
      }
      return events[0]?.id ?? null;
    });
  }, [hasEvents, events]);

  // Load stats whenever selected event changes
  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    let isCancelled = false;

    async function loadStats() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/sems/events/${selectedEventId}/stats`);
        const body = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: { stats: EventAttendanceStatsDto }; error?: { message?: string } }
          | null;

        if (!response.ok || !body?.success || !body.data) {
          throw new Error(body?.error?.message ?? "Unable to load attendance stats.");
        }

        if (!isCancelled) {
          setStats(body.data.stats);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Unable to load attendance stats.");
          setStats(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      isCancelled = true;
    };
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const totalRate = useMemo(() => {
    if (!stats) return 0;
    const total = stats.totalPresent + stats.totalLate + stats.totalAbsent;
    if (!total) return 0;
    return Math.round(((stats.totalPresent + stats.totalLate) / total) * 100);
  }, [stats]);

  const sessionColumns = useMemo(
    () => {
      if (!stats) return [] as Array<{ id: string; label: string; direction: SessionDirection }>;

      const cols: Array<{ id: string; label: string; direction: SessionDirection }> = [];
      const seen = new Set<string>();

      const addSession = (session?: SessionStatsDto) => {
        if (!session) return;
        if (seen.has(session.sessionId)) return;
        seen.add(session.sessionId);

        const baseLabel =
          session.period === "morning"
            ? "Morning"
            : session.period === "afternoon"
            ? "Afternoon"
            : "Evening";
        const suffix = session.direction === "in" ? "In" : "Out";

        cols.push({
          id: session.sessionId,
          label: `${baseLabel} ${suffix}`,
          direction: session.direction,
        });
      };

      for (const period of stats.periods) {
        addSession(period.inSession);
        addSession(period.outSession);
      }

      return cols;
    },
    [stats]
  );

  const generateAttendanceExcel = useCallback(async () => {
    if (!stats || !selectedEvent) return null;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "School Management System";
    workbook.created = new Date();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { key: "label", width: 25 },
      { key: "value", width: 30 }
    ];

    // Add summary data
    summarySheet.addRow({ label: "Event", value: stats.eventTitle });
    summarySheet.addRow({ label: "Date Range", value: `${selectedEvent.startDate} to ${selectedEvent.endDate}` });
    summarySheet.addRow({ label: "Export Date", value: new Date().toLocaleString() });
    summarySheet.addRow({ label: "", value: "" }); // Blank row
    summarySheet.addRow({ label: "Total Students", value: stats.uniqueStudents });
    summarySheet.addRow({ label: "Total Scans", value: stats.totalScans });
    summarySheet.addRow({ label: "Present", value: stats.totalPresent });
    summarySheet.addRow({ label: "Late", value: stats.totalLate });
    summarySheet.addRow({ label: "Absent", value: stats.totalAbsent });
    summarySheet.addRow({ label: "Overall Attendance Rate", value: `${totalRate}%` });

    // Style the summary sheet
    summarySheet.getColumn(1).font = { bold: true };
    summarySheet.getRow(1).font = { bold: true, size: 12 };

    // Sheet 2: Session Breakdown
    const sessionSheet = workbook.addWorksheet("Session Breakdown");
    sessionSheet.columns = [
      { header: "Period", key: "period", width: 15 },
      { header: "Entry Session", key: "entrySession", width: 20 },
      { header: "Entry Scans", key: "entryScans", width: 12 },
      { header: "Entry Present", key: "entryPresent", width: 14 },
      { header: "Entry Late", key: "entryLate", width: 12 },
      { header: "Exit Session", key: "exitSession", width: 20 },
      { header: "Exit Scans", key: "exitScans", width: 12 },
      { header: "Exit Present", key: "exitPresent", width: 14 },
      { header: "Exit Late", key: "exitLate", width: 12 },
      { header: "Missing Out", key: "missingOut", width: 12 }
    ];

    for (const period of stats.periods) {
      const periodLabel = period.period.charAt(0).toUpperCase() + period.period.slice(1);
      const inSession = period.inSession;
      const outSession = period.outSession;

      sessionSheet.addRow({
        period: periodLabel,
        entrySession: inSession?.name ?? "—",
        entryScans: inSession?.totalScans ?? 0,
        entryPresent: inSession?.present ?? 0,
        entryLate: inSession?.late ?? 0,
        exitSession: outSession?.name ?? "—",
        exitScans: outSession?.totalScans ?? 0,
        exitPresent: outSession?.present ?? 0,
        exitLate: outSession?.late ?? 0,
        missingOut: period.missingOutCount ?? 0
      });
    }

    // Style the session sheet header
    sessionSheet.getRow(1).font = { bold: true };
    sessionSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }
    };

    // Sheet 3: Student Attendance
    const studentSheet = workbook.addWorksheet("Student Attendance");

    // Build dynamic columns
    const studentColumns: Array<{ header: string; key: string; width: number }> = [
      { header: "Student Name", key: "name", width: 25 },
      { header: "Grade", key: "grade", width: 10 },
      { header: "Section", key: "section", width: 12 }
    ];

    // Add session columns
    for (const col of sessionColumns) {
      studentColumns.push({
        header: col.label,
        key: `session_${col.id}`,
        width: 15
      });
    }

    // Add summary columns
    studentColumns.push(
      { header: "Total Present", key: "totalPresent", width: 12 },
      { header: "Total Late", key: "totalLate", width: 12 },
      { header: "Total Absent", key: "totalAbsent", width: 12 },
      { header: "Attendance Rate", key: "attendanceRate", width: 15 }
    );

    studentSheet.columns = studentColumns;

    // Add student data
    for (const student of stats.students) {
      const rowData: Record<string, string | number> = {
        name: student.fullName,
        grade: student.gradeLevel ?? "—",
        section: student.section ?? "—"
      };

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      for (const col of sessionColumns) {
        const status = student.sessions[col.id] ?? "none";
        let statusText = "—";

        if (status === "present") {
          statusText = "Present";
          presentCount++;
        } else if (status === "late") {
          statusText = "Late";
          lateCount++;
        } else if (status === "no_scan") {
          statusText = "No Scan";
          absentCount++;
        }

        rowData[`session_${col.id}`] = statusText;
      }

      // Calculate student's attendance rate
      const totalSessions = presentCount + lateCount + absentCount;
      const studentRate = totalSessions > 0
        ? Math.round(((presentCount + lateCount) / totalSessions) * 100)
        : 0;

      rowData.totalPresent = presentCount;
      rowData.totalLate = lateCount;
      rowData.totalAbsent = absentCount;
      rowData.attendanceRate = `${studentRate}%`;

      studentSheet.addRow(rowData);
    }

    // Style the student sheet header
    studentSheet.getRow(1).font = { bold: true };
    studentSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }
    };

    return workbook;
  }, [stats, selectedEvent, sessionColumns, totalRate]);

  const handleExportExcel = useCallback(async () => {
    if (!stats || !selectedEvent) return;

    try {
      const workbook = await generateAttendanceExcel();
      if (!workbook) return;

      // Sanitize event title for filename
      const sanitizedTitle = stats.eventTitle.replace(/[^a-z0-9]/gi, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${sanitizedTitle}_Attendance_${dateStr}.xlsx`;

      await downloadExcelFile(filename, workbook);

      toast.success("Attendance data exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export attendance data");
    }
  }, [stats, selectedEvent, generateAttendanceExcel]);

  if (!hasEvents) {
    return (
      <Card className="border-dashed border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Event Attendance Insights</CardTitle>
          <CardDescription>No events available yet. Create an event to see attendance insights.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/10">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-4">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Event Attendance Insights
          </CardTitle>
          <CardDescription>
            Per-session breakdown of scans, late arrivals, and missing outs for a selected event.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {selectedEvent && (
            <Badge variant="outline" className="hidden md:inline-flex items-center gap-1 text-[11px]">
              <span
                className={`inline-flex h-1.5 w-1.5 rounded-full ${
                  selectedEvent.status === "live"
                    ? "bg-emerald-500"
                    : selectedEvent.status === "completed"
                    ? "bg-muted-foreground"
                    : "bg-amber-500"
                }`}
              />
              {selectedEvent.status}
            </Badge>
          )}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboboxOpen}
                className="w-full md:w-auto justify-between text-xs md:text-sm h-9 px-3"
              >
                {selectedEvent ? (
                  <div className="flex items-center gap-2 text-left">
                    <span className="font-medium">{selectedEvent.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedEvent.startDate} – {selectedEvent.endDate}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select event...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search events..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No event found.</CommandEmpty>
                  <CommandGroup>
                    {events.map((event) => (
                      <CommandItem
                        key={event.id}
                        value={`${event.title} ${event.startDate}`}
                        onSelect={() => {
                          setSelectedEventId(event.id);
                          setComboboxOpen(false);
                        }}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <div className="flex items-center w-full">
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selectedEventId === event.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="font-medium truncate">{event.title}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {event.startDate} – {event.endDate}
                            </span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!stats || isLoading || !!error}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={() => selectedEventId && setSelectedEventId(selectedEventId)}>
              Retry
            </Button>
          </div>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Select an event to view attendance insights.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-border/60 bg-card/80 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall Rate</span>
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-primary">{totalRate}%</span>
                  <span className="text-[11px] text-muted-foreground">present or late</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-card/80 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Unique Students</span>
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-foreground">{stats.uniqueStudents}</span>
                  <span className="text-[11px] text-muted-foreground">scanned at least once</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-card/80 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">On Time</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-foreground">{stats.totalPresent}</span>
                  <span className="text-[11px] text-muted-foreground">present</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-card/80 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Late & Absent</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{stats.totalLate}</span>
                    <span className="text-[11px] text-muted-foreground">late</span>
                  </div>
                  <div className="h-8 w-px bg-border/70" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{stats.totalAbsent}</span>
                    <span className="text-[11px] text-muted-foreground">absent</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/80 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Session-level breakdown by period. "Missing out" shows students who scanned IN but never scanned OUT.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-24 text-xs font-semibold text-primary">Period</TableHead>
                    <TableHead className="text-xs font-semibold text-primary">Entry Session</TableHead>
                    <TableHead className="text-xs font-semibold text-primary">Exit Session</TableHead>
                    <TableHead className="text-xs font-semibold text-primary">Present / Late / Absent</TableHead>
                    <TableHead className="text-xs font-semibold text-right text-primary">Missing Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.periods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No session configuration or attendance logs for this event yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.periods.map((period) => {
                      const label =
                        period.period === "morning"
                          ? "Morning"
                          : period.period === "afternoon"
                          ? "Afternoon"
                          : "Evening";

                      const missing = period.missingOutCount ?? 0;

                      return (
                        <TableRow key={period.period} className="hover:bg-muted/40">
                          <TableCell className="text-sm font-medium text-foreground">{label}</TableCell>
                          <TableCell className="align-top text-xs">
                            {period.inSession ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-foreground">{period.inSession.name}</span>
                                  <Badge variant="outline" className="text-[10px]">IN</Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {period.inSession.totalScans} scans • {period.inSession.present} present • {period.inSession.late} late
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No entry session</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {period.outSession ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-foreground">{period.outSession.name}</span>
                                  <Badge variant="outline" className="text-[10px]">OUT</Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {period.outSession.totalScans} scans • {period.outSession.present} present • {period.outSession.late} late
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No exit session</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400">
                                Present: {period.inSession?.present ?? 0}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400">
                                Late: {period.inSession?.late ?? 0}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-400">
                                Absent: {period.inSession?.absent ?? 0}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-right text-xs">
                            {missing > 0 ? (
                              <span className="inline-flex items-center justify-end gap-1 text-red-400 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {missing}
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-end gap-1 text-emerald-400 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                All exited
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/80 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Per-student attendance by session. "No Scan" on an exit session means the student scanned IN but never scanned OUT.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="min-w-[160px] text-xs font-semibold text-primary">Student</TableHead>
                      <TableHead className="w-32 text-xs font-semibold text-primary">Grade / Section</TableHead>
                      {sessionColumns.map((col) => (
                        <TableHead
                          key={col.id}
                          className="text-xs font-semibold text-primary text-center whitespace-nowrap"
                        >
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.students.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2 + sessionColumns.length}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          No student scans recorded for this event yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.students.map((student) => (
                        <TableRow key={student.studentId} className="hover:bg-muted/40">
                          <TableCell className="text-sm font-medium text-foreground">
                            {student.fullName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {student.gradeLevel || student.section
                              ? `${student.gradeLevel ?? ""}${
                                  student.gradeLevel && student.section ? " • " : ""
                                }${student.section ?? ""}`
                              : "—"}
                          </TableCell>
                          {sessionColumns.map((col) => {
                            const status = student.sessions[col.id] ?? "none";

                            if (status === "none") {
                              return (
                                <TableCell
                                  key={col.id}
                                  className="text-[11px] text-muted-foreground text-center"
                                >
                                  —
                                </TableCell>
                              );
                            }

                            const isExit = col.direction === "out";
                            let label = "Scanned";
                            let className =
                              "text-[11px] inline-flex items-center justify-center px-2 py-0.5 rounded-full border";

                            if (status === "present") {
                              label = "Scanned";
                              className +=
                                " bg-emerald-500/10 text-emerald-300 border-emerald-500/60";
                            } else if (status === "late") {
                              label = "Late";
                              className +=
                                " bg-amber-500/10 text-amber-300 border-amber-500/60";
                            } else if (status === "no_scan" && isExit) {
                              label = "No Scan";
                              className += " bg-red-500/10 text-red-300 border-red-500/60";
                            } else {
                              label = "No Scan";
                              className += " bg-muted text-muted-foreground border-border/60";
                            }

                            return (
                              <TableCell key={col.id} className="text-center align-middle">
                                <span className={className}>{label}</span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
