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
  { value: "SCANNER", label: "Scanner", description: "Event scanning access" },
  { value: "STAFF", label: "Staff", description: "General staff access" },
  { value: "PARENT", label: "Parent", description: "Parent portal access" },
];

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-[#1B4D3E] text-white border-[#1B4D3E]",
  ADMIN: "bg-[#1B4D3E]/80 text-white border-[#1B4D3E]/80",
  TEACHER: "bg-blue-100 text-blue-700 border-blue-200",
  SCANNER: "bg-purple-100 text-purple-700 border-purple-200",
  STAFF: "bg-gray-100 text-gray-700 border-gray-200",
  PARENT: "bg-amber-100 text-amber-700 border-amber-200",
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

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.primaryRole === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handlers
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

    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, primaryRole: updateRoleForm, roles: [updateRoleForm] }
            : u
        )
      );

      setIsUpdateRoleDialogOpen(false);
      toast.success("Role updated successfully", {
        description: `${selectedUser.fullName}'s role has been changed to ${updateRoleForm}`,
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
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>
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
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="px-4 py-4 sm:px-6">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="font-semibold text-foreground">User</TableHead>
                <TableHead className="font-semibold text-foreground">Role</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground hidden md:table-cell">
                  Last Login
                </TableHead>
                <TableHead className="font-semibold text-foreground w-[60px]">
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
                        className={
                          user.isActive
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }
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
                  {ROLE_OPTIONS.map((role) => (
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
                <Label htmlFor="newRole" className="text-sm font-medium text-muted-foreground">
                  New Role
                </Label>
                <Select value={updateRoleForm} onValueChange={(v: UserRole) => setUpdateRoleForm(v)}>
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsUpdateRoleDialogOpen(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={isSubmitting || updateRoleForm === selectedUser?.primaryRole}
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
                  className={`ml-auto ${
                    selectedUser.isActive
                      ? "bg-green-100 text-green-700 border-green-200"
                      : "bg-red-100 text-red-700 border-red-200"
                  }`}
                >
                  {selectedUser.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {selectedUser.isActive && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
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
