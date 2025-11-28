"use client";

import { useEffect, useState } from "react";
import {
  Users,
  School,
  ClipboardCheck,
  GraduationCap,
  Wallet,
  Briefcase,
  Bus,
  Library,
  MessageSquare,
  QrCode,
  TrendingUp,
  Menu,
  X,
  ChevronLeft,
  Bell,
  Building2,
  LogOut,
  User,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import appSettings from "@/appsettings.json";
import PageTransition from "@/components/page-transition";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/core/auth/types";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTheme } from "next-themes";

type PhaseId = "phase1" | "phase2" | "phase3" | "phase4" | "phase5";

interface ModuleConfig {
  id: string;
  name: string;
  shortName: string;
  phase: PhaseId;
  icon: React.ElementType;
  href: string;
  status: "active" | "upcoming";
  allowedRoles?: UserRole[];
}

const MODULES: ModuleConfig[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    shortName: "Dashboard",
    phase: "phase1",
    icon: TrendingUp,
    href: "/dashboard",
    status: "active",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    id: "sems",
    name: "Events",
    shortName: "Events",
    phase: "phase1",
    icon: QrCode,
    href: "/sems",
    status: "active",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    id: "sis",
    name: "Registry",
    shortName: "Registry",
    phase: "phase1",
    icon: Users,
    href: "/sis",
    status: "active",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    id: "facilities",
    name: "Facilities & Assets",
    shortName: "Facilities",
    phase: "phase4",
    icon: Building2,
    href: "/facilities",
    status: "active",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  { id: "academic", name: "Academic Structure", shortName: "Academics", phase: "phase2", icon: School, href: "/dashboard/academic", status: "upcoming" },
  { id: "attendance", name: "Daily Attendance", shortName: "Attendance", phase: "phase2", icon: ClipboardCheck, href: "/dashboard/attendance", status: "upcoming" },
  { id: "exams", name: "Examination & Grading", shortName: "Exams", phase: "phase2", icon: GraduationCap, href: "/dashboard/exams", status: "upcoming" },
  { id: "finance", name: "Finance & Fees", shortName: "Finance", phase: "phase3", icon: Wallet, href: "/dashboard/finance", status: "upcoming" },
  { id: "hr", name: "HR & Payroll", shortName: "HR", phase: "phase3", icon: Briefcase, href: "/dashboard/hr", status: "upcoming" },
  { id: "transport", name: "Transport & Fleet", shortName: "Transport", phase: "phase4", icon: Bus, href: "/dashboard/transport", status: "upcoming" },
  { id: "library", name: "Library Management", shortName: "Library", phase: "phase4", icon: Library, href: "/dashboard/library", status: "upcoming" },
  { id: "portal", name: "Parent Portal", shortName: "Portal", phase: "phase5", icon: MessageSquare, href: "/dashboard/portal", status: "upcoming" },
];

type DashboardShellProps = {
  children: React.ReactNode;
  mobileTitle: string;
  mobileDescription: string;
};

export default function DashboardShell({ children, mobileTitle, mobileDescription }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const canManageUsers = hasRole(["SUPER_ADMIN", "ADMIN"]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex font-sans text-foreground">
      <aside
        className={`fixed lg:sticky lg:top-0 left-0 z-40 bg-sidebar border-r border-sidebar-border transform transition-all duration-300 ease-in-out flex flex-col overflow-hidden h-screen lg:h-screen ${
          isCollapsed ? "lg:w-20" : "lg:w-64"
        } w-64 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div
          className={`h-16 flex items-center border-b border-sidebar-border  ${
            isCollapsed ? "px-2 lg:px-0 lg:justify-center" : "px-4"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                setIsCollapsed(false);
              }
            }}
            className={`flex items-center gap-3 focus:outline-none ${
              isCollapsed ? "cursor-pointer hover:opacity-90" : ""
            }`}
            aria-label={isCollapsed ? "Expand sidebar" : appSettings.appName}
          >
            <div className="relative w-8 h-8">
              <Image src="/basic-ed-logo.png" alt="Logo" fill className="object-contain" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-primary text-lg tracking-tight">{appSettings.appName}</span>
            )}
          </button>
          <div
            className={`ml-auto flex items-center gap-2 ${
              isCollapsed ? "lg:hidden" : ""
            }`}
          >
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="hidden lg:inline-flex items-center justify-center h-7 px-3 rounded-full border border-border bg-card/80 text-muted-foreground hover:text-primary hover:bg-card shadow-sm transition-colors"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-2 hide-scrollbar transition-all duration-300 ease-in-out ${
            isCollapsed ? "px-2" : "px-3"
          }`}
        >
          <div
            className={`px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider transition-all duration-300 origin-left ${
              isCollapsed
                ? "mt-0 h-0 py-0 opacity-0 -translate-x-2 overflow-hidden"
                : "h-6 py-2 opacity-100 translate-x-0"
            }`}
          >
            Modules
          </div>
          {MODULES.map((module) => {
            const isActive = pathname === module.href;
            const hasModuleAccess = !module.allowedRoles || hasRole(module.allowedRoles);
            const isDisabled = module.status !== "active" || !hasModuleAccess;

            return (
              <button
                key={module.id}
                onClick={() => {
                  if (!isDisabled) {
                    router.push(module.href);
                  }
                }}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isCollapsed ? "justify-center gap-0" : "gap-3"
                } ${
                  isDisabled
                    ? "text-muted-foreground/50 cursor-not-allowed opacity-60"
                    : `group border ${
                        isActive
                          ? "bg-card text-primary shadow-sm border-primary/10"
                          : "border-transparent text-muted-foreground hover:bg-accent hover:text-primary"
                      }`
                }`}
              >
                <module.icon
                  className={`w-4 h-4 transition-colors ${
                    !isDisabled
                      ? isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary"
                      : ""
                  }`}
                />
                <span
                  className={`overflow-hidden text-left whitespace-nowrap transition-all duration-300 origin-left ml-0 ${
                    isCollapsed
                      ? "max-w-0 opacity-0 translate-x-2"
                      : "max-w-[80px] opacity-100 translate-x-0 ml-2"
                  }`}
                >
                  {module.shortName}
                </span>
                {module.status === "upcoming" && !isCollapsed && (
                  <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-semibold border border-border">
                    Soon
                  </span>
                )}
                {module.status === "active" && !hasModuleAccess && !isCollapsed && (
                  <span className="ml-auto text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-md font-semibold border border-destructive/30">
                    Restricted
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-full rounded-2xl bg-card border border-border shadow-sm flex items-center transition-all duration-300 ease-in-out hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  isCollapsed ? "justify-center px-2 py-2" : "px-3 py-3 gap-3"
                }`}
              >
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage
                    src={user && "avatarUrl" in user ? (user as any).avatarUrl ?? undefined : undefined}
                    alt={user?.fullName ?? "User"}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user?.fullName ?? "User"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {user?.email ?? "signed in"}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              className="w-56 rounded-xl border border-border bg-popover shadow-lg"
              sideOffset={8}
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.fullName ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email ?? "signed in"}
                </p>
              </div>
              <div className="p-1">
                <DropdownMenuItem
                  onClick={() => router.push("/profile")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary"
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Profile</span>
                </DropdownMenuItem>
                {canManageUsers && (
                  <DropdownMenuItem
                    onClick={() => router.push("/users")}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary"
                  >
                    <UsersRound className="w-4 h-4" />
                    <span className="text-sm font-medium">Manage Users</span>
                  </DropdownMenuItem>
                )}
              </div>
              <div className="px-3 pt-1 pb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em] mb-1">
                  Theme
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                      theme === "light"
                        ? "bg-primary/10 text-primary border-primary/70"
                        : "bg-background/40 text-muted-foreground border-border/70"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                      theme === "dark"
                        ? "bg-primary/10 text-primary border-primary/70"
                        : "bg-background/40 text-muted-foreground border-border/70"
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                      !theme || theme === "system"
                        ? "bg-primary/10 text-primary border-primary/70"
                        : "bg-background/40 text-muted-foreground border-border/70"
                    }`}
                  >
                    System
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <div className="p-1">
                <DropdownMenuItem
                  onClick={() => void logout()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Logout</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!isCollapsed && (
          <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
            <div className="w-full text-[11px] leading-snug text-muted-foreground text-center">
              <p className="font-medium text-muted-foreground">
                @ 2025 {appSettings.appName} v{appSettings.version}
              </p>
              <p className="mt-0.5">
                Initiated by <span className="font-semibold text-primary">SSC</span>
              </p>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0 bg-transparent">
        <PageTransition>
          <main className="flex-1 w-full py-4 lg:py-8 px-3 lg:px-4 flex flex-col space-y-6">
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <div>
                <h1 className="text-lg font-bold text-foreground">{mobileTitle}</h1>
                <p className="text-xs text-muted-foreground">{mobileDescription}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-card/80 border border-border text-muted-foreground shadow-sm hover:bg-card"
                  aria-label="Open navigation"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-card/70 border border-border text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                </button>
              </div>
            </div>
            {children}
          </main>
        </PageTransition>
      </div>

      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-background/80 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
