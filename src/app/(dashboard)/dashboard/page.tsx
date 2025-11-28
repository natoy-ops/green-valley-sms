"use client";

import { useEffect, useState } from "react";
import { 
  Users,
  ShieldAlert,
  Calendar,
  Building2,
  ClipboardCheck,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/shared/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface DashboardStats {
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

interface RecentEvent {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  facilityName: string | null;
  sessionsCount: number;
  status: "upcoming" | "ongoing" | "completed";
}

interface RecentUser {
  id: string;
  fullName: string;
  email: string;
  primaryRole: string;
  lastLoginAt: string | null;
}

interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentEvents: RecentEvent[];
  recentUsers: RecentUser[];
  attendanceSummary: AttendanceSummary;
}

function StatCardSkeleton() {
  return (
    <Card className="border border-border/50 bg-gradient-to-br from-card via-card to-muted/20">
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function UserSkeleton() {
  return (
    <div className="flex items-start gap-3 pb-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const response = await fetch("/api/dashboard", {
          credentials: "include",
        });

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const result = await response.json();
        if (result.success) {
          setDashboardData(result.data);
        } else {
          setError(result.error?.message || "Unknown error");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  // Show loading state while validating session
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // RBAC Guard - check if user has admin or super_admin role
  const hasAccess = user?.roles.some(role => role === "ADMIN" || role === "SUPER_ADMIN");
  
  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-card rounded-xl shadow-lg border border-destructive/20 max-w-md">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to view the Analytics Dashboard. Please contact your system administrator.</p>
          <Button onClick={() => window.history.back()} variant="outline" className="w-full">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats;
  const attendanceSummary = dashboardData?.attendanceSummary;
  const totalAttendance = attendanceSummary 
    ? attendanceSummary.present + attendanceSummary.late + attendanceSummary.absent 
    : 0;
  const attendanceRate = totalAttendance > 0 
    ? Math.round(((attendanceSummary?.present ?? 0) + (attendanceSummary?.late ?? 0)) / totalAttendance * 100) 
    : 0;

  const statCards = [
    {
      label: "Total Students",
      value: stats?.totalStudents ?? 0,
      subtext: `${stats?.activeStudents ?? 0} active`,
      icon: Users,
      gradient: "from-emerald-500/10 via-transparent to-transparent dark:from-emerald-500/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-t-emerald-500",
    },
    {
      label: "Events",
      value: stats?.totalEvents ?? 0,
      subtext: `${stats?.upcomingEvents ?? 0} upcoming`,
      icon: Calendar,
      gradient: "from-sky-500/10 via-transparent to-transparent dark:from-sky-500/20",
      iconBg: "bg-sky-100 dark:bg-sky-900/50",
      iconColor: "text-sky-600 dark:text-sky-400",
      borderColor: "border-t-sky-500",
    },
    {
      label: "Attendance Logs",
      value: stats?.totalAttendanceLogs ?? 0,
      subtext: `${stats?.todayAttendanceLogs ?? 0} today`,
      icon: ClipboardCheck,
      gradient: "from-amber-500/10 via-transparent to-transparent dark:from-amber-500/20",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-t-amber-500",
    },
    {
      label: "Facilities",
      value: stats?.totalFacilities ?? 0,
      subtext: `${stats?.operationalFacilities ?? 0} operational`,
      icon: Building2,
      gradient: "from-violet-500/10 via-transparent to-transparent dark:from-violet-500/20",
      iconBg: "bg-violet-100 dark:bg-violet-900/50",
      iconColor: "text-violet-600 dark:text-violet-400",
      borderColor: "border-t-violet-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your school management system</p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 1. Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          statCards.map((item, idx) => (
            <Card
              key={idx}
              className={`border border-border/50 border-t-4 ${item.borderColor} shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 bg-gradient-to-br ${item.gradient} bg-card`}
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">
                    {item.value.toLocaleString()}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{item.subtext}</p>
                </div>
                <div className={`p-3 rounded-xl ${item.iconBg}`}>
                  <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 2. Recent Event Activity + 3. System Health / Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Event Activity Table */}
        <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm bg-gradient-to-br from-card via-card to-muted/10">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Recent Events</CardTitle>
                <CardDescription>Latest events and their status</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-secondary text-primary hover:bg-secondary/20"
                onClick={() => window.location.href = "/sems"}
              >
                View All Events
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4 px-4">
            {loading ? (
              <TableSkeleton />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-bold text-primary">Event Name</TableHead>
                      <TableHead className="font-bold text-primary">Facility</TableHead>
                      <TableHead className="font-bold text-primary">Date</TableHead>
                      <TableHead className="text-right font-bold text-primary">Sessions</TableHead>
                      <TableHead className="text-right font-bold text-primary">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData?.recentEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No events found
                        </TableCell>
                      </TableRow>
                    ) : (
                      dashboardData?.recentEvents.map((event) => (
                        <TableRow key={event.id} className="hover:bg-muted/20">
                          <TableCell className="font-medium text-foreground">{event.title}</TableCell>
                          <TableCell className="text-muted-foreground">{event.facilityName ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {event.startDate 
                              ? new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">{event.sessionsCount}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                event.status === "ongoing"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                                  : event.status === "completed"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                              }`}
                            >
                              {event.status === "ongoing" && <Activity className="w-3 h-3 animate-pulse" />}
                              {event.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                              {event.status === "upcoming" && <Clock className="w-3 h-3" />}
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health / Quick Actions */}
        <div className="space-y-6">
          {/* Attendance Summary */}
          <Card
            className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card to-primary/5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-transform"
            onClick={() => {
              if (!loading) {
                window.location.href = "/sems";
              }
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Attendance Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-primary">{attendanceRate}%</div>
                    <p className="text-xs text-muted-foreground">Overall attendance rate</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-sm text-muted-foreground">Present</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{attendanceSummary?.present ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-sm text-muted-foreground">Late</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{attendanceSummary?.late ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-sm text-muted-foreground">Absent</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{attendanceSummary?.absent ?? 0}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card to-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground">Database</span>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded">
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground">API Gateway</span>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded">
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground">Auth Service</span>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded">
                  Operational
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Logins */}
          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card to-secondary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-secondary" />
                Recent Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <UserSkeleton />
                  <UserSkeleton />
                  <UserSkeleton />
                </>
              ) : dashboardData?.recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent logins</p>
              ) : (
                dashboardData?.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-start gap-3 pb-3 border-b border-border/30 last:border-0 last:pb-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.primaryRole} • {user.lastLoginAt 
                          ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                          : "Never"
                        }
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
