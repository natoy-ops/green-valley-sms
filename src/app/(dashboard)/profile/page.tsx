"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CalendarDays,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  UserCircle2,
  Mail,
  Building2,
} from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import type { UserRole } from "@/core/auth/types";

interface ProfileDto {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  primaryRole: UserRole;
  isActive: boolean;
  schoolId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  lastSignInAt: string | null;
}

interface ProfileResponse {
  success?: boolean;
  data?: { profile?: ProfileDto };
  error?: { message?: string };
}

interface PasswordResponse {
  success?: boolean;
  error?: { message?: string };
}

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-[#1B4D3E] text-white border-[#1B4D3E]",
  ADMIN: "bg-[#1B4D3E]/80 text-white border-[#1B4D3E]/60",
  TEACHER: "bg-blue-100 text-blue-700 border-blue-200",
  STUDENT: "bg-green-100 text-green-700 border-green-200",
  SCANNER: "bg-purple-100 text-purple-700 border-purple-200",
  STAFF: "bg-gray-100 text-gray-700 border-gray-200",
  PARENT: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function ProfilePage() {
  const { user: authUser, isSuperAdmin, isAdmin, refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    fullName: "",
    schoolId: "",
    primaryRole: "STAFF" as UserRole,
    isActive: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] = useState(false);
  const passwordSectionRef = useRef<HTMLDivElement | null>(null);

  const canManageRoles = useMemo(() => isSuperAdmin() || isAdmin(), [isSuperAdmin, isAdmin]);

  const scrollToPasswordSection = useCallback(() => {
    passwordSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { method: "GET" });
      const json = (await res.json().catch(() => null)) as ProfileResponse | null;

      if (!res.ok || !json?.success || !json.data?.profile) {
        throw new Error(json?.error?.message ?? "Unable to load profile");
      }

      const incoming = json.data.profile;
      setProfile(incoming);
      setFormState({
        fullName: incoming.fullName,
        schoolId: incoming.schoolId ?? "",
        primaryRole: incoming.primaryRole,
        isActive: incoming.isActive,
      });
    } catch (error) {
      console.error("[ProfilePage] Failed to load profile", error);
      toast.error(error instanceof Error ? error.message : "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (!profile) return;

    const payload: Record<string, unknown> = {};
    if (formState.fullName.trim() !== profile.fullName) {
      payload.fullName = formState.fullName.trim();
    }

    const normalizedSchoolId = formState.schoolId.trim() || null;
    if (normalizedSchoolId !== (profile.schoolId ?? null)) {
      payload.schoolId = normalizedSchoolId;
    }

    if (canManageRoles && formState.primaryRole !== profile.primaryRole) {
      payload.primaryRole = formState.primaryRole;
    }

    if (canManageRoles && formState.isActive !== profile.isActive) {
      payload.isActive = formState.isActive;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ProfileResponse | null;

      if (!res.ok || !json?.success || !json.data?.profile) {
        throw new Error(json?.error?.message ?? "Unable to update profile");
      }

      setProfile(json.data.profile);
      toast.success("Profile updated");
      void refreshUser();
    } catch (error) {
      console.error("[ProfilePage] Failed to save profile", error);
      toast.error(error instanceof Error ? error.message : "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }, [canManageRoles, formState.fullName, formState.isActive, formState.primaryRole, formState.schoolId, profile, refreshUser]);

  const handlePasswordChange = useCallback(async () => {
    const current = passwordForm.currentPassword.trim();
    const next = passwordForm.newPassword.trim();
    const confirm = passwordForm.confirmPassword.trim();

    if (!current || !next || !confirm) {
      toast.error("Please complete all password fields");
      return;
    }

    if (next !== confirm) {
      toast.error("New password and confirmation must match");
      return;
    }

    if (next.length < 12 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
      toast.error("Password must be 12+ chars with upper, lower, and number");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = (await res.json().catch(() => null)) as PasswordResponse | null;

      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Unable to update password");
      }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordResetDialogOpen(true);
    } catch (error) {
      console.error("[ProfilePage] Failed to change password", error);
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setPasswordSaving(false);
    }
  }, [passwordForm]);

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activeBadge = profile?.isActive ? (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 border-red-200">Inactive</Badge>
  );

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gradient-to-br from-background via-background to-muted/30">
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-primary/80 font-semibold">
                Profile
              </p>
              <h1 className="text-3xl font-bold text-foreground mt-1">Account Overview</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your personal details, roles, and security settings.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={scrollToPasswordSection}
                className="border-primary/40 text-primary hover:bg-primary/10"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Change password
              </Button>
              <Button
                variant="outline"
                onClick={() => loadProfile()}
                disabled={loading}
                className="border-border text-muted-foreground hover:bg-accent"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || loading || !profile}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <ProfileSkeleton />
        ) : profile ? (
          <div className="space-y-6">
            <Card className="border border-border bg-card/90 backdrop-blur shadow-md">
              <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-border">
                    <AvatarImage src={undefined} alt={profile.fullName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                      {profile.fullName?.charAt(0) ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">Signed in as</p>
                    <p className="text-2xl font-semibold text-foreground">{profile.fullName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {profile.email}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.roles.map((role) => (
                        <Badge key={role} className={`${ROLE_BADGE_STYLES[role]} font-semibold`}> 
                          {role.replace("_", " ")}
                        </Badge>
                      ))}
                      {activeBadge}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Primary role: <span className="font-semibold text-foreground">{profile.primaryRole}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    Last sign-in: <span className="font-semibold text-foreground">{formatDate(profile.lastSignInAt)}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border border-border bg-card">
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                  <CardDescription>Basic information used across the platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input
                        id="fullName"
                        value={formState.fullName}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, fullName: event.target.value }))
                        }
                        placeholder="Juan Dela Cruz"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email address</Label>
                      <Input value={profile.email} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>School / Campus ID</Label>
                      <div className="flex gap-3">
                        <Input
                          value={formState.schoolId}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, schoolId: event.target.value }))
                          }
                          placeholder="00000000-0000-0000-0000-000000000000"
                          readOnly
                          disabled
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Currently reserved for multi-campus deployments to link your account with specific campuses.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border bg-card">
                <CardHeader>
                  <CardTitle>Role & Access</CardTitle>
                  <CardDescription>Access level inside the administrative console.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Primary role</Label>
                    {canManageRoles ? (
                      <Select
                        value={formState.primaryRole}
                        onValueChange={(value: UserRole) =>
                          setFormState((prev) => ({ ...prev, primaryRole: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {profile.roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                        <ShieldQuestion className="w-4 h-4 text-primary" />
                        {profile.primaryRole.replace("_", " ")}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Determines default landing pages and permissions.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {profile.isActive ? "Account is active" : "Account disabled"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Active users can sign in to all assigned modules.
                        </p>
                      </div>
                      <Switch
                        checked={formState.isActive}
                        onCheckedChange={(value) =>
                          canManageRoles && setFormState((prev) => ({ ...prev, isActive: value }))
                        }
                        disabled={!canManageRoles}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Audit trail</Label>
                    <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground space-y-1">
                      <p className="flex items-center gap-2">
                        <UserCircle2 className="w-4 h-4 text-primary" />
                        Created: <span className="font-medium text-foreground">{formatDate(profile.createdAt)}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        Updated: <span className="font-medium text-foreground">{formatDate(profile.updatedAt)}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div ref={passwordSectionRef}>
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle>Security & Activity</CardTitle>
                <CardDescription>Monitor recent sign-ins and manage your password.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-10 h-10 rounded-full bg-primary/10 text-primary p-2" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last sign-in</p>
                        <p className="text-base font-semibold text-foreground">{formatDate(profile.lastSignInAt)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      If something looks unfamiliar, contact your administrator immediately.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-10 h-10 rounded-full bg-primary/10 text-primary p-2" />
                      <div>
                        <p className="text-sm text-muted-foreground">Linked campus</p>
                        <p className="text-base font-semibold text-foreground">
                          {profile.schoolId ? profile.schoolId : "Not assigned"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Campus linkage ensures you only access data relevant to your institution.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">Change password</p>
                    <p className="text-sm text-muted-foreground">
                      Use at least 12 characters with uppercase, lowercase, and numbers.
                    </p>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={passwordVisibility.current ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                          }
                          placeholder="••••••••••••"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPasswordVisibility((prev) => ({ ...prev, current: !prev.current }))
                          }
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                          aria-label={passwordVisibility.current ? "Hide password" : "Show password"}
                        >
                          {passwordVisibility.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={passwordVisibility.new ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                          }
                          placeholder="••••••••••••"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPasswordVisibility((prev) => ({ ...prev, new: !prev.new }))
                          }
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                          aria-label={passwordVisibility.new ? "Hide new password" : "Show new password"}
                        >
                          {passwordVisibility.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm new password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={passwordVisibility.confirm ? "text" : "password"}
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                          }
                          placeholder="••••••••••••"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPasswordVisibility((prev) => ({ ...prev, confirm: !prev.confirm }))
                          }
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                          aria-label={passwordVisibility.confirm ? "Hide confirmation" : "Show confirmation"}
                        >
                          {passwordVisibility.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      onClick={handlePasswordChange}
                      disabled={passwordSaving}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {passwordSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Update password
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        ) : (
          <EmptyState onRetry={loadProfile} />
        )}
      </div>
      <AlertDialog open={isPasswordResetDialogOpen} onOpenChange={setIsPasswordResetDialogOpen}>
        <AlertDialogContent className="bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Password updated</AlertDialogTitle>
            <AlertDialogDescription>
              Please sign back in with your new password to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setIsPasswordResetDialogOpen(false);
                void logout();
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Re-login now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 rounded-2xl bg-white/60 border border-gray-100 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-96 rounded-2xl bg-white/60 border border-gray-100 animate-pulse lg:col-span-2" />
        <div className="h-96 rounded-2xl bg-white/60 border border-gray-100 animate-pulse" />
      </div>
      <div className="h-48 rounded-2xl bg-white/60 border border-gray-100 animate-pulse" />
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-dashed border-2 border-gray-200 bg-white/70">
      <CardContent className="py-16 text-center space-y-4">
        <p className="text-lg font-semibold text-gray-900">Profile unavailable</p>
        <p className="text-sm text-gray-500">
          We couldn’t load your account details. Please refresh the page or try again later.
        </p>
        <Button onClick={onRetry} className="bg-[#1B4D3E] hover:bg-[#1B4D3E]/90 text-white">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
