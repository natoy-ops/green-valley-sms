"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  KeyRound,
  Shield,
  UserX,
  UserCheck,
  Loader2,
  Upload,
  FileSpreadsheet,
  Info,
  Mail,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/shared/hooks/useAuth";
import type { UserRole } from "@/core/auth/types";

// ============================================================================
// Types
// ============================================================================

interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  primaryRole: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin", description: "Full system access" },
  { value: "ADMIN", label: "Admin", description: "Administrative access" },
  { value: "TEACHER", label: "Teacher", description: "Teaching staff access" },
  { value: "STUDENT", label: "Student", description: "Student portal access" },
  { value: "SCANNER", label: "Scanner", description: "Event scanning access" },
  { value: "STAFF", label: "Staff", description: "General staff access" },
  { value: "PARENT", label: "Parent", description: "Parent portal access" },
];

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-primary text-primary-foreground border-primary",
  ADMIN: "bg-primary/80 text-primary-foreground border-primary/80",
  TEACHER: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  STUDENT: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  SCANNER: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  STAFF: "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  PARENT: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
};

const STATUS_BADGE_STYLES = {
  active: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  inactive: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
};

// ============================================================================
// Mock Data (Replace with API calls)
// ============================================================================

const MOCK_USERS: UserListItem[] = [
  {
    id: "1",
    email: "superadmin@gvcfis.edu.ph",
    fullName: "Super Admin",
    roles: ["SUPER_ADMIN"],
    primaryRole: "SUPER_ADMIN",
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
    lastLoginAt: "2024-11-26T10:30:00Z",
  },
  {
    id: "2",
    email: "admin@gvcfis.edu.ph",
    fullName: "John Administrator",
    roles: ["ADMIN"],
    primaryRole: "ADMIN",
    isActive: true,
    createdAt: "2024-02-15T00:00:00Z",
    lastLoginAt: "2024-11-25T14:20:00Z",
  },
  {
    id: "3",
    email: "teacher1@gvcfis.edu.ph",
    fullName: "Maria Santos",
    roles: ["TEACHER"],
    primaryRole: "TEACHER",
    isActive: true,
    createdAt: "2024-03-10T00:00:00Z",
    lastLoginAt: "2024-11-26T08:15:00Z",
  },
  {
    id: "4",
    email: "scanner1@gvcfis.edu.ph",
    fullName: "Pedro Cruz",
    roles: ["SCANNER"],
    primaryRole: "SCANNER",
    isActive: true,
    createdAt: "2024-04-20T00:00:00Z",
    lastLoginAt: "2024-11-26T07:00:00Z",
  },
  {
    id: "5",
    email: "staff1@gvcfis.edu.ph",
    fullName: "Ana Reyes",
    roles: ["STAFF"],
    primaryRole: "STAFF",
    isActive: false,
    createdAt: "2024-05-05T00:00:00Z",
    lastLoginAt: "2024-10-15T09:30:00Z",
  },
];

// ============================================================================
// Component
// ============================================================================

export default function ManageUsersPage() {
  const { user: currentUser, isSuperAdmin, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importRole, setImportRole] = useState<UserRole>("STAFF");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateRoleDialogOpen, setIsUpdateRoleDialogOpen] = useState(false);
  const [isToggleStatusDialogOpen, setIsToggleStatusDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [isCreateSuccessAlertOpen, setIsCreateSuccessAlertOpen] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<UserListItem | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetResultOpen, setIsResetResultOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserListItem | null>(null);
  const [lastResetPassword, setLastResetPassword] = useState<string | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    role: "STAFF" as UserRole,
  });
  const [updateRoleForm, setUpdateRoleForm] = useState<UserRole>("STAFF");
  const [updateRoles, setUpdateRoles] = useState<UserRole[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load users
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users", {
        method: "GET",
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { users?: UserListItem[] };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !json?.success || !Array.isArray(json.data?.users)) {
        const message = json?.error?.message || "Failed to load users";
        toast.error(message);
        return;
      }

      setUsers(json.data.users);
    } catch (error) {
      toast.error("Failed to load users");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Filter and sort users alphabetically by name
  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || user.primaryRole === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.isActive) ||
        (statusFilter === "inactive" && !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Handlers
  const handleDownloadTemplate = () => {
    if (typeof window === "undefined") return;

    const link = document.createElement("a");
    link.href = "/api/users/import-students/template";
    link.download = "user-import-template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCredentialsCsv = (
    credentials: { email: string; temporaryPassword: string }[]
  ) => {
    if (typeof window === "undefined" || credentials.length === 0) return;

    const header = "Email,Temporary Password";
    const rows = credentials.map((cred) => {
      const safeEmail = String(cred.email ?? "").replace(/"/g, '""');
      const safePassword = String(cred.temporaryPassword ?? "").replace(/"/g, '""');
      return `"${safeEmail}","${safePassword}"`;
    });

    const csv = [header, ...rows].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
    link.href = url;
    link.download = `user-credentials-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportStudents = async () => {
    if (!importFile) {
      toast.error("Please select an Excel file to import.");
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("role", importRole);

      const response = await fetch("/api/users/import-students", {
        method: "POST",
        body: formData,
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              summary?: {
                total: number;
                created: number;
                skipped: number;
              };
              credentials?: { email: string; temporaryPassword: string }[];
            };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !json?.success || !json.data?.summary) {
        const message = json?.error?.message || "Failed to import users";
        toast.error(message);
        return;
      }

      const { summary, credentials = [] } = json.data;

      toast.success(
        `Imported ${summary.created} of ${summary.total} user${
          summary.total === 1 ? "" : "s"
        }`
      );

      if (credentials.length > 0) {
        downloadCredentialsCsv(credentials);
      }

      setIsImportDialogOpen(false);
      setImportFile(null);

      await loadUsers();
    } catch (error) {
      console.error(error);
      toast.error("Failed to import users");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateUser = async () => {
    const fullName = createForm.fullName.trim();
    const email = createForm.email.trim().toLowerCase();

    if (!fullName || !email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          role: createForm.role,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { user?: UserListItem };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !json?.success) {
        const message = json?.error?.message || "Failed to create user";
        toast.error(message);
        return;
      }

      const createdUser = json.data?.user;

      if (createdUser) {
        setUsers((prev) => [...prev, createdUser]);
        setLastCreatedUser(createdUser);
      } else {
        // Fallback: reload list if payload did not contain the user
        await loadUsers();
        setLastCreatedUser(null);
      }

      setIsCreateDialogOpen(false);
      setCreateForm({ fullName: "", email: "", role: "STAFF" });
      setIsCreateSuccessAlertOpen(true);
    } catch (error) {
      toast.error("Failed to create user");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetUserPassword = async () => {
    if (!resetTargetUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: resetTargetUser.id }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { password?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !json?.success || typeof json.data?.password !== "string") {
        const message = json?.error?.message || "Failed to reset password";
        toast.error(message);
        return;
      }

      const password = json.data.password;
      setIsResetConfirmOpen(false);
      setLastResetPassword(password);
      setIsResetResultOpen(true);
    } catch (error) {
      toast.error("Failed to reset password");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordClick = (user: UserListItem) => {
    setResetTargetUser(user);
    setLastResetPassword(null);
    setIsResetConfirmOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    if (updateRoles.length === 0) {
      toast.error("At least one role must be assigned.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          primaryRole: updateRoleForm,
          roles: updateRoles,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { user?: UserListItem };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !json?.success || !json.data?.user) {
        const message = json?.error?.message || "Failed to update role";
        toast.error(message);
        return;
      }

      const updatedUser = json.data.user;

      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );

      setIsUpdateRoleDialogOpen(false);
      const primaryLabel = updatedUser.primaryRole.replace("_", " ");
      const rolesLabel = updatedUser.roles
        .map((role) => role.replace("_", " "))
        .join(", ");

      toast.success("Roles updated successfully", {
        description: `${updatedUser.fullName} now has primary role ${primaryLabel} and assigned roles: ${rolesLabel}.`,
      });
    } catch (error) {
      toast.error("Failed to update role");
      console.error(error);
    } finally {
      setIsSubmitting(false);
      setSelectedUser(null);
    }
  };

  const handleToggleUserStatus = async () => {
    if (!selectedUser) return;

    const targetStatus = !selectedUser.isActive;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          isActive: targetStatus,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { user?: UserListItem };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !json?.success || !json.data?.user) {
        const message = json?.error?.message || "Failed to update user status";
        toast.error(message);
        return;
      }

      const updatedUser = json.data.user;
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

      setIsToggleStatusDialogOpen(false);
      toast.success(updatedUser.isActive ? "User enabled" : "User disabled", {
        description: `${updatedUser.fullName} has been ${updatedUser.isActive ? "enabled" : "disabled"}`,
      });
      setSelectedUser(null);
    } catch (error) {
      toast.error("Failed to update user status");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUpdateRoleDialog = (user: UserListItem) => {
    setSelectedUser(user);
    setUpdateRoleForm(user.primaryRole);
    setUpdateRoles(
      Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles
        : [user.primaryRole]
    );
    setIsUpdateRoleDialogOpen(true);
  };

  const openToggleStatusDialog = (user: UserListItem) => {
    setSelectedUser(user);
    setIsToggleStatusDialogOpen(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canManageUser = (user: UserListItem) => {
    // Super admins can see the Actions menu for all users (including themselves)
    if (isSuperAdmin()) return true;
    // Admins can manage non-admin users
    if (isAdmin()) return !["SUPER_ADMIN", "ADMIN"].includes(user.primaryRole);
    return false;
  };

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-background via-background to-muted/30">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Users</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create, update, and manage user accounts and permissions
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)}
              className="border-border text-muted-foreground hover:bg-accent gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Users
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border focus:border-primary focus:ring-primary/20"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-card border-border">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px] bg-card border-border">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col max-h-[calc(100vh-280px)]">
          <div className="px-4 py-4 sm:px-6 overflow-y-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted">
                  <TableHead className="font-semibold text-foreground bg-muted">User</TableHead>
                  <TableHead className="font-semibold text-foreground bg-muted">Role</TableHead>
                  <TableHead className="font-semibold text-foreground bg-muted">Status</TableHead>
                  <TableHead className="font-semibold text-foreground bg-muted hidden md:table-cell">
                    Last Login
                  </TableHead>
                  <TableHead className="font-semibold text-foreground bg-muted w-[60px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading users...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <p className="text-muted-foreground">No users found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-accent">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={undefined} alt={user.fullName} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                            {user.fullName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {user.fullName}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${ROLE_BADGE_STYLES[user.primaryRole]} font-medium`}
                      >
                        {user.primaryRole.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={user.isActive ? STATUS_BADGE_STYLES.active : STATUS_BADGE_STYLES.inactive}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell>
                      {canManageUser(user) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 rounded-lg border border-border bg-popover shadow-lg"
                          >
                            <DropdownMenuItem
                              onClick={() => handleResetPasswordClick(user)}
                              className="gap-2 cursor-pointer text-foreground hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary"
                            >
                              <KeyRound className="w-4 h-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openUpdateRoleDialog(user)}
                              className="gap-2 cursor-pointer text-foreground hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary"
                            >
                              <Shield className="w-4 h-4" />
                              Update Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => openToggleStatusDialog(user)}
                              className={`gap-2 cursor-pointer ${
                                user.isActive
                                  ? "text-red-600 hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700"
                                  : "text-green-600 hover:bg-green-50 hover:text-green-700 focus:bg-green-50 focus:text-green-700"
                              }`}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="w-4 h-4" />
                                  Disable User
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4" />
                                  Enable User
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* Import Users Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card rounded-xl border border-border shadow-xl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Import User Accounts
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Upload an Excel file (.xlsx or .xls) with user information. The first row
                  should contain <span className="font-medium">Full Name</span> and
                  {" "}
                  <span className="font-medium">Email</span> columns. Email is used as the
                  login identifier.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-dashed border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <Info className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">
                  Temporary passwords are generated for each user.
                </p>
                <p className="text-muted-foreground">
                  After a successful import, a CSV with
                  {" "}
                  <span className="font-medium">Email</span>
                  {" / "}
                  <span className="font-medium">Temporary Password</span>
                  {" "}
                  pairs will download automatically.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid gap-4 text-xs sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <FileSpreadsheet className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Template columns</p>
                  <p className="text-muted-foreground">Full Name, Email</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Email as login</p>
                  <p className="text-muted-foreground">Users sign in using email.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">One-time passwords</p>
                  <p className="text-muted-foreground">Share CSV securely after import.</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label
                  htmlFor="import-role"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Role to import <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={importRole}
                  onValueChange={(value: UserRole) => setImportRole(value)}
                >
                  <SelectTrigger className="border-border focus:border-primary focus:ring-primary/20">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.filter(
                      (role) =>
                        !["SUPER_ADMIN", "ADMIN", "STUDENT", "PARENT"].includes(
                          role.value
                        )
                    ).map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-file" className="text-sm font-medium text-muted-foreground">
                  Excel File <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="user-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImportFile(file);
                  }}
                  className="border-border focus:border-primary focus:ring-primary/20 cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Each row should include at least a full name and a valid email address. Accounts
                  will be created with the selected role.
                </p>
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="h-7 px-2 text-xs border-dashed border-border text-muted-foreground hover:bg-accent flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Download template</span>
                  </Button>
                </div>
                {importFile && (
                  <p className="text-xs text-foreground">
                    Selected file:
                    {" "}
                    <span className="font-medium">{importFile.name}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportFile(null);
              }}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportStudents}
              disabled={isImporting || !importFile}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-xl border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Create New User
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new user to the system with the selected role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-muted-foreground">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="Enter full name"
                value={createForm.fullName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                className="border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@school.edu.ph"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-muted-foreground">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.role}
                onValueChange={(value: UserRole) =>
                  setCreateForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className="border-border focus:border-primary focus:ring-primary/20">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.filter(
                    (role) => !["STUDENT", "PARENT"].includes(role.value)
                  ).map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{role.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_OPTIONS.find((r) => r.value === createForm.role)?.description}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Success Alert */}
      <AlertDialog open={isCreateSuccessAlertOpen} onOpenChange={setIsCreateSuccessAlertOpen}>
        <AlertDialogContent className="sm:max-w-md bg-card rounded-xl border border-border shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              User created successfully
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
              {lastCreatedUser ? (
                <>
                  The account for
                  {" "}
                  <span className="font-medium text-foreground">
                    {lastCreatedUser.fullName}
                  </span>
                  {" ("}
                  <span className="font-mono text-foreground">{lastCreatedUser.email}</span>
                  {") "}
                  has been created.
                </>
              ) : (
                <>The new user account has been created.</>
              )}
            </AlertDialogDescription>
            <AlertDialogDescription className="mt-3 text-sm text-muted-foreground">
              To share their login details, open the
              {" "}
              <span className="font-medium text-foreground">Actions</span>
              {" "}
              menu for this user, choose
              {" "}
              <span className="font-medium text-foreground">Reset Password</span>, then copy
              the one-time password and send it to them through a secure channel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogAction
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Confirm Alert */}
      <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md bg-card rounded-xl border border-border shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Reset password?
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
              {resetTargetUser ? (
                <>
                  This will generate a new password for
                  {" "}
                  <span className="font-medium text-foreground">
                    {resetTargetUser.fullName}
                  </span>
                  . Their existing password will no longer work.
                </>
              ) : (
                <>This will generate a new password for the selected user.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void resetUserPassword();
              }}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Result Alert */}
      <AlertDialog open={isResetResultOpen} onOpenChange={setIsResetResultOpen}>
        <AlertDialogContent className="sm:max-w-md bg-card rounded-xl border border-border shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              New password generated
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
              {resetTargetUser ? (
                <>
                  Share this password securely with
                  {" "}
                  <span className="font-medium text-gray-900">
                    {resetTargetUser.fullName}
                  </span>
                  . It will not be shown again here.
                </>
              ) : (
                <>Share this password securely with the user. It will not be shown again.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {lastResetPassword && (
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-2 py-1 text-sm text-foreground break-all">
                {lastResetPassword}
              </code>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(lastResetPassword);
                    toast.success("Password copied to clipboard");
                  } catch (err) {
                    console.error(err);
                    toast.error("Failed to copy password");
                  }
                }}
              >
                Copy
              </Button>
            </div>
          )}
          <AlertDialogFooter className="mt-6">
            <AlertDialogAction
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Role Dialog */}
      <Dialog open={isUpdateRoleDialogOpen} onOpenChange={setIsUpdateRoleDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-xl border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Update User Role
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Change the role and permissions for this user.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border/50">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {selectedUser.fullName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedUser.fullName}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Current Role
                </Label>
                <Badge className={`${ROLE_BADGE_STYLES[selectedUser.primaryRole]}`}>
                  {selectedUser.primaryRole.replace("_", " ")}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Assigned Roles
                </Label>
                <div className="flex flex-wrap gap-2">
                  {updateRoles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No additional roles are assigned.
                    </p>
                  ) : (
                    updateRoles.map((role) => (
                      <div key={role} className="relative inline-flex">
                        <Badge
                          className={`${ROLE_BADGE_STYLES[role]} font-medium pr-5`}
                        >
                          {role.replace("_", " ")}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => {
                            setUpdateRoles((prev) => {
                              const next = prev.filter((r) => r !== role);
                              if (!next.length) {
                                return prev;
                              }

                              if (role === updateRoleForm && next[0]) {
                                setUpdateRoleForm(next[0]);
                              }

                              return next;
                            });
                          }}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground/70 shadow hover:text-foreground"
                          aria-label={`Remove ${role.replace("_", " ")}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  These roles control which modules this user can access.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Add role
                </Label>
                <Select
                  onValueChange={(value: UserRole) => {
                    setUpdateRoles((prev) =>
                      prev.includes(value) ? prev : [...prev, value]
                    );
                  }}
                >
                  <SelectTrigger className="border-border focus:border-primary focus:ring-primary/20">
                    <SelectValue placeholder="Select an additional role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.filter(
                      (role) => !updateRoles.includes(role.value)
                    ).map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <span className="font-medium">{role.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Add secondary roles to mirror how this user works in the system.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newRole" className="text-sm font-medium text-muted-foreground">
                  Primary role
                </Label>
                <Select
                  value={updateRoleForm}
                  onValueChange={(v: UserRole) => {
                    setUpdateRoleForm(v);
                    setUpdateRoles((prev) =>
                      prev.includes(v) ? prev : [...prev, v]
                    );
                  }}
                >
                  <SelectTrigger className="border-border focus:border-primary focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <span className="font-medium">{role.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ROLE_OPTIONS.find((r) => r.value === updateRoleForm)?.description}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsUpdateRoleDialogOpen(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={
                isSubmitting ||
                (updateRoleForm === selectedUser?.primaryRole &&
                  updateRoles.length === selectedUser?.roles.length &&
                  updateRoles.every((r) => selectedUser?.roles.includes(r)))
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Status Dialog */}
      <Dialog open={isToggleStatusDialogOpen} onOpenChange={setIsToggleStatusDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-xl border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              {selectedUser?.isActive ? "Disable User" : "Enable User"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedUser?.isActive
                ? "This user will no longer be able to access the system."
                : "This user will regain access to the system."}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border/50">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {selectedUser.fullName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedUser.fullName}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Badge
                  className={`ml-auto ${selectedUser.isActive ? STATUS_BADGE_STYLES.active : STATUS_BADGE_STYLES.inactive}`}
                >
                  {selectedUser.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {selectedUser.isActive && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Warning:</strong> Disabling this user will immediately revoke
                    their access. Any active sessions will be terminated.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <Button
              variant="outline"
              onClick={() => setIsToggleStatusDialogOpen(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleUserStatus}
              disabled={isSubmitting}
              className={
                selectedUser?.isActive
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
                  : "bg-emerald-600 hover:bg-emerald-700 text-emerald-50 gap-2"
              }
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedUser?.isActive ? "Disable User" : "Enable User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
