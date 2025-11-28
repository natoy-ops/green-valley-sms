import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { ADMIN_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";

function formatSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

function formatError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalEvents: number;
  upcomingEvents: number;
  totalAttendanceLogs: number;
  todayAttendanceLogs: number;
  totalFacilities: number;
  operationalFacilities: number;
  totalUsers: number;
  activeUsers: number;
}

export interface RecentEvent {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  facilityName: string | null;
  sessionsCount: number;
  status: "upcoming" | "ongoing" | "completed";
}

export interface RecentUser {
  id: string;
  fullName: string;
  email: string;
  primaryRole: string;
  lastLoginAt: string | null;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentEvents: RecentEvent[];
  recentUsers: RecentUser[];
  attendanceSummary: AttendanceSummary;
}

export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  try {
    // Fetch all stats in parallel
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [
      studentsResult,
      activeStudentsResult,
      eventsResult,
      upcomingEventsResult,
      attendanceLogsResult,
      todayLogsResult,
      facilitiesResult,
      operationalFacilitiesResult,
      usersResult,
      activeUsersResult,
      recentEventsResult,
      recentUsersResult,
      attendanceSummaryResult,
    ] = await Promise.all([
      // Total students
      supabase.from("students").select("id", { count: "exact", head: true }),
      // Active students
      supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
      // Total events
      supabase.from("events").select("id", { count: "exact", head: true }),
      // Upcoming events (start_date >= today)
      supabase.from("events").select("id", { count: "exact", head: true }).gte("start_date", todayIso.split("T")[0]),
      // Total attendance logs
      supabase.from("attendance_logs").select("id", { count: "exact", head: true }),
      // Today's attendance logs
      supabase.from("attendance_logs").select("id", { count: "exact", head: true }).gte("scanned_at", todayIso),
      // Total facilities
      supabase.from("facilities").select("id", { count: "exact", head: true }),
      // Operational facilities
      supabase.from("facilities").select("id", { count: "exact", head: true }).eq("status", "operational"),
      // Total users
      supabase.from("app_users").select("id", { count: "exact", head: true }),
      // Active users
      supabase.from("app_users").select("id", { count: "exact", head: true }).eq("is_active", true),
      // Recent events with facility info
      supabase
        .from("events")
        .select(`
          id,
          title,
          start_date,
          end_date,
          facility_id,
          facilities(name)
        `)
        .order("created_at", { ascending: false })
        .limit(5),
      // Recent users with last login
      supabase
        .from("app_users")
        .select("id, full_name, email, primary_role, last_login_at")
        .order("last_login_at", { ascending: false, nullsFirst: false })
        .limit(5),
      // Attendance summary (all time)
      supabase
        .from("attendance_logs")
        .select("status"),
    ]);

    // Calculate event session counts for recent events
    const recentEventIds = (recentEventsResult.data ?? []).map((e: { id: string }) => e.id);
    const { data: eventSessionsData } = await supabase
      .from("event_sessions")
      .select("event_id")
      .in("event_id", recentEventIds);

    const sessionCountByEvent = new Map<string, number>();
    (eventSessionsData ?? []).forEach((session: { event_id: string }) => {
      const count = sessionCountByEvent.get(session.event_id) ?? 0;
      sessionCountByEvent.set(session.event_id, count + 1);
    });

    // Build recent events with status
    const recentEvents: RecentEvent[] = (recentEventsResult.data ?? []).map((event) => {
      const startDate = event.start_date ? new Date(event.start_date) : null;
      const endDate = event.end_date ? new Date(event.end_date) : null;
      const now = new Date();

      let status: "upcoming" | "ongoing" | "completed" = "upcoming";
      if (startDate && endDate) {
        if (now < startDate) {
          status = "upcoming";
        } else if (now > endDate) {
          status = "completed";
        } else {
          status = "ongoing";
        }
      } else if (startDate) {
        status = now >= startDate ? "ongoing" : "upcoming";
      }

      const facilities = event.facilities as unknown;
      let facilityName: string | null = null;

      if (Array.isArray(facilities)) {
        facilityName = facilities.length > 0 ? facilities[0]?.name ?? null : null;
      } else if (facilities && typeof facilities === "object") {
        facilityName = (facilities as { name?: string }).name ?? null;
      }

      return {
        id: event.id,
        title: event.title,
        startDate: event.start_date,
        endDate: event.end_date,
        facilityName,
        sessionsCount: sessionCountByEvent.get(event.id) ?? 0,
        status,
      };
    });

    // Build recent users
    const recentUsers: RecentUser[] = (recentUsersResult.data ?? []).map((user: {
      id: string;
      full_name: string;
      email: string;
      primary_role: string;
      last_login_at: string | null;
    }) => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      primaryRole: user.primary_role,
      lastLoginAt: user.last_login_at,
    }));

    // Calculate attendance summary
    const attendanceLogs = attendanceSummaryResult.data ?? [];
    const attendanceSummary: AttendanceSummary = {
      present: attendanceLogs.filter((log: { status: string }) => log.status === "present").length,
      late: attendanceLogs.filter((log: { status: string }) => log.status === "late").length,
      absent: attendanceLogs.filter((log: { status: string }) => log.status === "absent").length,
    };

    const stats: DashboardStats = {
      totalStudents: studentsResult.count ?? 0,
      activeStudents: activeStudentsResult.count ?? 0,
      totalEvents: eventsResult.count ?? 0,
      upcomingEvents: upcomingEventsResult.count ?? 0,
      totalAttendanceLogs: attendanceLogsResult.count ?? 0,
      todayAttendanceLogs: todayLogsResult.count ?? 0,
      totalFacilities: facilitiesResult.count ?? 0,
      operationalFacilities: operationalFacilitiesResult.count ?? 0,
      totalUsers: usersResult.count ?? 0,
      activeUsers: activeUsersResult.count ?? 0,
    };

    const dashboardData: DashboardData = {
      stats,
      recentEvents,
      recentUsers,
      attendanceSummary,
    };

    return formatSuccess(dashboardData);
  } catch (error) {
    return formatError(
      500,
      "DASHBOARD_FETCH_FAILED",
      "Unable to load dashboard data.",
      error instanceof Error ? error.message : error
    );
  }
}
