"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Users, UsersRound, X, FileSpreadsheet, FileText, Download, ChevronDown, Loader2, Settings, Layers, LayoutGrid, GraduationCap, UserCheck, TrendingUp, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type StudentStatus = "Active" | "Inactive" | "Pending";

type StudentRecord = {
  id: string;
  name: string;
  grade: string;
  section: string;
  lrn: string;
  status: StudentStatus;
  guardianPhone: string | null;
  guardianEmail: string | null;
};

type StudentCredential = {
  studentName: string;
  email: string;
  temporaryPassword: string;
};

type GuardianCredential = {
  guardianName: string;
  email: string;
  temporaryPassword: string;
  linkedStudents: string[];
};

type GuardianRecord = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  linkedStudents: {
    studentId: string;
    studentName: string;
    lrn: string;
    grade: string;
    section: string;
    relationship: string | null;
    isPrimary: boolean;
  }[];
};

type LevelOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type SectionOption = {
  id: string;
  name: string;
  levelId: string | null;
  isActive: boolean;
};

function shouldRedirectToLogin(response: Response): boolean {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return true;
  }
  return false;
}

export default function RegistryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const levelOptions = levels.map((level) => level.name);
  const sectionOptions = sections.map((section) => section.name);
  const [newLevel, setNewLevel] = useState("");
  const [editLevelId, setEditLevelId] = useState<string>("");
  const [editLevelName, setEditLevelName] = useState<string>("");
  const [newSection, setNewSection] = useState("");
  const [newSectionLevelId, setNewSectionLevelId] = useState<string>("__none__");
  const [editSectionId, setEditSectionId] = useState<string>("");
  const [editSectionName, setEditSectionName] = useState<string>("");
  const [editSectionLevelId, setEditSectionLevelId] = useState<string>("__none__");
  const [isLevelDialogOpen, setIsLevelDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [levelsSectionsError, setLevelsSectionsError] = useState<string | null>(null);
  const [isSavingLevelOrSection, setIsSavingLevelOrSection] = useState(false);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [addStudentLevelName, setAddStudentLevelName] = useState<string>("");
  const [isEditStudentDialogOpen, setIsEditStudentDialogOpen] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [editStudentLevelName, setEditStudentLevelName] = useState<string>("");
  const [isImportingStudents, setIsImportingStudents] = useState(false);
  const [bulkImportMessage, setBulkImportMessage] = useState<string | null>(null);
  const [bulkImportErrors, setBulkImportErrors] = useState<
    { rowNumber: number; message: string }[]
  >([]);
  const [addStudentSectionName, setAddStudentSectionName] = useState<string>("");
  const [addStudentStatus, setAddStudentStatus] = useState<StudentStatus>("Active");
  const [editStudentSectionName, setEditStudentSectionName] = useState<string>("");
  const [editStudentStatus, setEditStudentStatus] = useState<StudentStatus>("Active");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [studentCredentialsForDownload, setStudentCredentialsForDownload] = useState<
    StudentCredential[]
  >([]);
  const [guardianCredentialsForDownload, setGuardianCredentialsForDownload] = useState<
    GuardianCredential[]
  >([]);
  const [bulkImportStatus, setBulkImportStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Guardians state
  const [guardians, setGuardians] = useState<GuardianRecord[]>([]);
  const [isLoadingGuardians, setIsLoadingGuardians] = useState(false);
  const [guardiansError, setGuardiansError] = useState<string | null>(null);
  const [guardianSearchTerm, setGuardianSearchTerm] = useState("");
  const [isEditGuardianDialogOpen, setIsEditGuardianDialogOpen] = useState(false);
  const [editGuardian, setEditGuardian] = useState<GuardianRecord | null>(null);
  const [editGuardianFullName, setEditGuardianFullName] = useState("");
  const [editGuardianEmail, setEditGuardianEmail] = useState("");
  const [editGuardianIsActive, setEditGuardianIsActive] = useState(true);
  const [isUpdatingGuardian, setIsUpdatingGuardian] = useState(false);
  const [editGuardianError, setEditGuardianError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("students");

  // Insight detail dialogs
  type InsightDialogType = "total" | "active" | "grade" | "section" | null;
  const [activeInsightDialog, setActiveInsightDialog] = useState<InsightDialogType>(null);

  const downloadCsvFile = (filename: string, headers: string[], rows: string[][]) => {
    if (typeof window === "undefined" || rows.length === 0) return;

    const escapeCsv = (value: string): string => {
      if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replace(/\"/g, '""')}"`;
      }
      return value;
    };

    const lines = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  function resetBulkImportState(preserveCredentials = false) {
    setBulkFileName(null);
    setBulkImportMessage(null);
    setBulkImportErrors([]);
    if (!preserveCredentials) {
      setStudentCredentialsForDownload([]);
      setGuardianCredentialsForDownload([]);
    }
    setIsImportingStudents(false);
    setBulkImportStatus("idle");
  }

  function clearCredentialsBanner() {
    setStudentCredentialsForDownload([]);
    setGuardianCredentialsForDownload([]);
  }

  async function handleExportQrCodes(format: "excel" | "word") {
    if (isExporting) return;

    setIsExporting(true);
    setIsExportMenuOpen(false);

    try {
      // Build query params based on current filters
      const params = new URLSearchParams();
      params.set("format", format);

      // If filtering by level, find the level ID
      if (levelFilter !== "all") {
        const level = levels.find((l) => l.name === levelFilter);
        if (level) {
          params.set("levelId", level.id);
        }
      }

      // If filtering by section, find the section ID
      if (sectionFilter !== "all") {
        const section = sections.find((s) => s.name === sectionFilter);
        if (section) {
          params.set("sectionId", section.id);
        }
      }

      const response = await fetch(`/api/sis/students/export?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Export failed");
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "excel" 
        ? `student_qr_codes_${Date.now()}.xlsx` 
        : `student_qr_cards_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert(error instanceof Error ? error.message : "Failed to export QR codes");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleBulkImportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImportingStudents) return;

    setBulkImportMessage(null);
    setBulkImportErrors([]);
    setIsImportingStudents(true);
    setBulkImportStatus("loading");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      const fileInput = form.querySelector<HTMLInputElement>("#bulk-import-file");
      const file = fileInput?.files?.[0] ?? null;

      if (!file) {
        setBulkImportMessage("Please choose a CSV file before continuing.");
        setIsImportingStudents(false);
        setBulkImportStatus("error");
        return;
      }

      formData.set("file", file);

      const response = await fetch("/api/sis/students/import", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              summary?: { totalRows: number; importedCount: number; failedCount: number };
              errors?: { rowNumber: number; message: string }[];
              students?: StudentRecord[];
              studentCredentials?: {
                studentName: string;
                email: string;
                temporaryPassword: string;
              }[];
              guardianCredentials?: {
                guardianName: string;
                email: string;
                temporaryPassword: string;
                linkedStudents: string[];
              }[];
            };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data?.summary) {
        const message = body?.error?.message ?? "Unable to import students. Please try again.";
        setBulkImportMessage(message);
        setIsImportingStudents(false);
        setBulkImportStatus("error");
        return;
      }

      const summary = body.data.summary;
      const imported = body.data.students ?? [];
      const studentCredentials = body.data.studentCredentials ?? [];
      const guardianCredentials = body.data.guardianCredentials ?? [];

      // All-or-nothing: if any row failed, do not insert any students
      if (summary.failedCount > 0) {
        const message =
          "Some rows reference levels/sections that don't exist yet. Fix them in the CSV or create the missing levels/sections, then try again.";
        setBulkImportMessage(message);
        setBulkImportErrors(body.data.errors ?? []);
        setIsImportingStudents(false);
        setBulkImportStatus("error");
        return;
      }

      if (imported.length > 0) {
        setStudents((previous: StudentRecord[]) => {
          const byId = new Map<string, StudentRecord>();

          // Start with existing students
          for (const student of previous) {
            byId.set(student.id, student);
          }

          // Overlay imported students (latest data wins)
          for (const student of imported) {
            byId.set(student.id, student);
          }

          return Array.from(byId.values());
        });
      }
      setStudentCredentialsForDownload(studentCredentials);
      setGuardianCredentialsForDownload(guardianCredentials);

      const createdStudentAccounts = studentCredentials.length;
      const createdGuardianAccounts = guardianCredentials.length;

      const summaryMessage = `Imported ${summary.importedCount} of ${summary.totalRows} rows.`;
      const accountMessage =
        createdStudentAccounts > 0 || createdGuardianAccounts > 0
          ? `${createdStudentAccounts} new student account${
              createdStudentAccounts === 1 ? "" : "s"
            }, ${createdGuardianAccounts} new parent account${
              createdGuardianAccounts === 1 ? "" : "s"
            }.`
          : "No new login credentials were generated.";

      const message = `${summaryMessage} ${accountMessage}`;
      setBulkImportMessage(message);
      setIsImportingStudents(false);
      setBulkImportStatus("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to import students. Please try again.";
      setBulkImportMessage(message);
      setIsImportingStudents(false);
      setBulkImportStatus("error");
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadLevelsAndSections() {
      setLevelsSectionsError(null);

      try {
        const response = await fetch("/api/sis/levels?includeInactive=true", {
          method: "GET",
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: { levels: LevelOption[]; sections: SectionOption[] };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !body?.success || !body.data) {
          const message = body?.error?.message ?? "Unable to load levels and sections.";
          throw new Error(message);
        }

        if (!isCancelled) {
          setLevels(body.data.levels);
          setSections(body.data.sections);
        }
      } catch (error) {
        if (!isCancelled) {
          setLevelsSectionsError(
            error instanceof Error ? error.message : "Unable to load levels and sections."
          );
        }
      }
    }

    void loadLevelsAndSections();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadStudents() {
      setIsLoadingStudents(true);
      setStudentsError(null);

      try {
        const response = await fetch("/api/sis/students", {
          method: "GET",
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: { students: StudentRecord[] };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !body || !body.success || !body.data) {
          const message = body?.error?.message ?? "Unable to load students.";
          throw new Error(message);
        }

        if (!isCancelled) {
          setStudents(body.data.students);
        }
      } catch (error) {
        if (!isCancelled) {
          setStudentsError(
            error instanceof Error ? error.message : "Unable to load students."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingStudents(false);
        }
      }
    }

    void loadStudents();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Load guardians when switching to parents tab
  useEffect(() => {
    if (activeTab !== "parents") return;
    if (guardians.length > 0) return; // Already loaded

    let isCancelled = false;

    async function loadGuardians() {
      setIsLoadingGuardians(true);
      setGuardiansError(null);

      try {
        const response = await fetch("/api/sis/guardians", {
          method: "GET",
        });

        if (shouldRedirectToLogin(response)) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              data?: { guardians: GuardianRecord[] };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !body || !body.success || !body.data) {
          const message = body?.error?.message ?? "Unable to load guardians.";
          throw new Error(message);
        }

        if (!isCancelled) {
          setGuardians(body.data.guardians);
        }
      } catch (error) {
        if (!isCancelled) {
          setGuardiansError(
            error instanceof Error ? error.message : "Unable to load guardians."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingGuardians(false);
        }
      }
    }

    void loadGuardians();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, guardians.length]);

  async function handleEditGuardianSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUpdatingGuardian) return;
    if (!editGuardian) return;

    setEditGuardianError(null);

    const rawFullName = editGuardianFullName.trim();
    const rawEmail = editGuardianEmail.trim();

    if (!rawFullName) {
      setEditGuardianError("Full name is required.");
      return;
    }

    if (!rawEmail) {
      setEditGuardianError("Email is required.");
      return;
    }

    setIsUpdatingGuardian(true);

    try {
      const response = await fetch("/api/sis/guardians", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editGuardian.id,
          fullName: rawFullName,
          email: rawEmail,
          isActive: editGuardianIsActive,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { guardian: GuardianRecord };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to update guardian. Please try again.";
        throw new Error(message);
      }

      const updatedGuardian = body.data.guardian;
      setGuardians((previous) =>
        previous.map((g) => (g.id === updatedGuardian.id ? updatedGuardian : g))
      );

      setIsEditGuardianDialogOpen(false);
      setEditGuardian(null);
    } catch (error) {
      setEditGuardianError(
        error instanceof Error
          ? error.message
          : "Unable to update guardian. Please try again."
      );
    } finally {
      setIsUpdatingGuardian(false);
    }
  }

  const filteredGuardians = guardians
    .filter((guardian) => {
      if (guardianSearchTerm.trim()) {
        const q = guardianSearchTerm.toLowerCase();
        const studentNames = guardian.linkedStudents.map((s) => s.studentName.toLowerCase()).join(" ");
        return (
          guardian.fullName.toLowerCase().includes(q) ||
          guardian.email.toLowerCase().includes(q) ||
          studentNames.includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  async function handleDisableSectionClick() {
    const id = editSectionId.trim();

    if (!id) return;

    if (isSavingLevelOrSection) return;

    const selected = sections.find((section) => section.id === id);

    if (!selected) return;

    const nextIsActive = !selected.isActive;

    setIsSavingLevelOrSection(true);
    setLevelsSectionsError(null);

    try {
      const response = await fetch("/api/sis/sections", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: nextIsActive }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { section: SectionOption };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to update section status.";
        throw new Error(message);
      }

      setSections((previous) => {
        const updated = body.data!.section;
        return previous.map((section) => (section.id === updated.id ? updated : section));
      });

      setEditSectionId("");
      setEditSectionName("");
      setEditSectionLevelId("");
    } catch (error) {
      setLevelsSectionsError(
        error instanceof Error ? error.message : "Unable to update section status."
      );
    } finally {
      setIsSavingLevelOrSection(false);
    }
  }

  async function handleAddLevelClick() {
    const value = newLevel.trim();
    if (!value) return;

    if (isSavingLevelOrSection) return;

    setIsSavingLevelOrSection(true);
    setLevelsSectionsError(null);

    try {
      const response = await fetch("/api/sis/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: value }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { level: LevelOption };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to add level.";
        throw new Error(message);
      }

      setLevels((previous) => {
        const exists = previous.some(
          (level) => level.name.toLowerCase() === body.data!.level.name.toLowerCase()
        );
        if (exists) return previous;
        return [...previous, body.data!.level].sort((a, b) => a.name.localeCompare(b.name));
      });

      setNewLevel("");
    } catch (error) {
      setLevelsSectionsError(error instanceof Error ? error.message : "Unable to add level.");
    } finally {
      setIsSavingLevelOrSection(false);
    }
  }

  async function handleDisableLevelClick() {
    const id = editLevelId.trim();

    if (!id) return;

    if (isSavingLevelOrSection) return;

    const selected = levels.find((level) => level.id === id);

    if (!selected) return;

    const nextIsActive = !selected.isActive;

    setIsSavingLevelOrSection(true);
    setLevelsSectionsError(null);

    try {
      const response = await fetch("/api/sis/levels", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: nextIsActive }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { level: LevelOption };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to update level status.";
        throw new Error(message);
      }

      setLevels((previous) => {
        const updated = body.data!.level;
        return previous.map((level) => (level.id === updated.id ? updated : level));
      });

      setEditLevelId("");
      setEditLevelName("");
    } catch (error) {
      setLevelsSectionsError(
        error instanceof Error ? error.message : "Unable to update level status."
      );
    } finally {
      setIsSavingLevelOrSection(false);
    }
  }

  async function handleUpdateLevelClick() {
    const id = editLevelId.trim();
    const value = editLevelName.trim();

    if (!id || !value) return;

    if (isSavingLevelOrSection) return;

    setIsSavingLevelOrSection(true);
    setLevelsSectionsError(null);

    try {
      const response = await fetch("/api/sis/levels", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, name: value }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { level: LevelOption };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to update level.";
        throw new Error(message);
      }

      setLevels((previous) => {
        const updated = body.data!.level;
        return previous
          .map((level) => (level.id === updated.id ? updated : level))
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      setEditLevelId("");
      setEditLevelName("");
    } catch (error) {
      setLevelsSectionsError(
        error instanceof Error ? error.message : "Unable to update level."
      );
    } finally {
      setIsSavingLevelOrSection(false);
    }
  }

  async function handleUpdateSectionClick() {
    const id = editSectionId.trim();
    const value = editSectionName.trim();

    if (!id || !value) return;

    if (isSavingLevelOrSection) return;

    setIsSavingLevelOrSection(true);
    setLevelsSectionsError(null);

    try {
      const response = await fetch("/api/sis/sections", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          name: value,
          levelId: editSectionLevelId === "__none__" ? null : editSectionLevelId || null,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { section: SectionOption };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to update section.";
        throw new Error(message);
      }

      setSections((previous) => {
        const updated = body.data!.section;
        return previous
          .map((section) => (section.id === updated.id ? updated : section))
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      setEditSectionId("");
      setEditSectionName("");
      setEditSectionLevelId("");
    } catch (error) {
      setLevelsSectionsError(
        error instanceof Error ? error.message : "Unable to update section."
      );
    } finally {
      setIsSavingLevelOrSection(false);
    }
  }

  async function handleAddSectionClick() {
    const value = newSection.trim();
    if (!value) return;

    if (isSavingLevelOrSection) return;

    setIsSavingLevelOrSection(true);
    setLevelsSectionsError(null);

    try {
      const response = await fetch("/api/sis/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: value,
          levelId: newSectionLevelId === "__none__" ? null : newSectionLevelId || null,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { section: SectionOption };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? "Unable to add section.";
        throw new Error(message);
      }

      setSections((previous) => {
        const exists = previous.some(
          (section) => section.name.toLowerCase() === body.data!.section.name.toLowerCase()
        );
        if (exists) return previous;
        return [...previous, body.data!.section].sort((a, b) => a.name.localeCompare(b.name));
      });

      setNewSection("");
      setNewSectionLevelId("");
    } catch (error) {
      setLevelsSectionsError(
        error instanceof Error ? error.message : "Unable to add section."
      );
    } finally {
      setIsSavingLevelOrSection(false);
    }
  }

  function getSectionsForLevelName(levelName: string): SectionOption[] {
    const level = levels.find((candidate) => candidate.name === levelName);
    if (!level) return [];
    return sections.filter(
      (section) => section.isActive && section.levelId === level.id
    );
  }

  async function handleAddStudentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSavingStudent) return;

    setAddStudentError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const rawName = (formData.get("name") ?? "").toString().trim();
    const rawLevel = (formData.get("level") ?? "").toString().trim();
    const rawSection = (formData.get("section") ?? "").toString().trim();
    const rawLrn = (formData.get("lrn") ?? "").toString().trim();
    const rawGuardianPhone = (formData.get("guardianPhone") ?? "").toString().trim();
    const rawGuardianEmail = (formData.get("guardianEmail") ?? "").toString().trim();
    const rawStatus = ((formData.get("status") ?? "Active") as string).trim() || "Active";

    const sectionsForSelectedLevel = rawLevel ? getSectionsForLevelName(rawLevel) : [];
    const levelHasSections = sectionsForSelectedLevel.length > 0;

    if (!rawName || !rawLevel || (levelHasSections && !rawSection)) {
      if (!rawName || !rawLevel) {
        setAddStudentError("Please fill in all required fields before saving.");
      } else {
        setAddStudentError("Please select a section for the chosen level.");
      }
      return;
    }

    setIsSavingStudent(true);

    try {
      const response = await fetch("/api/sis/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: rawName,
          levelName: rawLevel,
          sectionName: rawSection,
          lrn: rawLrn,
          status: rawStatus,
          guardianPhone: rawGuardianPhone || undefined,
          guardianEmail: rawGuardianEmail || undefined,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { student: StudentRecord };
            error?: {
              message?: string;
              details?: { field?: string; message?: string }[];
            };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const detailMessage =
          body?.error?.details &&
          Array.isArray(body.error.details) &&
          body.error.details.length > 0
            ? body.error.details[0]?.message ?? null
            : null;

        const message =
          detailMessage ??
          body?.error?.message ??
          "Unable to save student. Please try again.";

        throw new Error(message);
      }

      setStudents((previous) => [body.data!.student, ...previous]);

      form.reset();
      setIsAddStudentDialogOpen(false);
    } catch (error) {
      setAddStudentError(
        error instanceof Error
          ? error.message
          : "Unable to save student. Please try again."
      );
    } finally {
      setIsSavingStudent(false);
    }
  }

  async function handleEditStudentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUpdatingStudent) return;
    if (!editStudent) return;

    setEditStudentError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const rawName = (formData.get("name") ?? "").toString().trim();
    const rawLevel = (formData.get("level") ?? "").toString().trim();
    const rawSection = (formData.get("section") ?? "").toString().trim();
    const rawLrn = (formData.get("lrn") ?? "").toString().trim();
    const rawGuardianEmail = (formData.get("guardianEmail") ?? "").toString().trim();
    const rawStatus = ((formData.get("status") ?? "Active") as string).trim() || "Active";

    const sectionsForSelectedLevel = rawLevel ? getSectionsForLevelName(rawLevel) : [];
    const levelHasSections = sectionsForSelectedLevel.length > 0;

    if (!rawName || !rawLevel || (levelHasSections && !rawSection)) {
      if (!rawName || !rawLevel) {
        setEditStudentError("Please fill in all required fields before saving.");
      } else {
        setEditStudentError("Please select a section for the chosen level.");
      }
      return;
    }

    setIsUpdatingStudent(true);

    try {
      const response = await fetch("/api/sis/students", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editStudent.id,
          name: rawName,
          levelName: rawLevel,
          sectionName: rawSection,
          lrn: rawLrn,
          status: rawStatus,
          guardianEmail: rawGuardianEmail || undefined,
        }),
      });

      if (shouldRedirectToLogin(response)) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: { student: StudentRecord };
            error?: {
              message?: string;
              details?: { field?: string; message?: string }[];
            };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        const detailMessage =
          body?.error?.details &&
          Array.isArray(body.error.details) &&
          body.error.details.length > 0
            ? body.error.details[0]?.message ?? null
            : null;

        const message =
          detailMessage ??
          body?.error?.message ??
          "Unable to update student. Please try again.";

        throw new Error(message);
      }

      const updatedStudent = body.data.student;
      setStudents((previous) =>
        previous.map((student) => (student.id === updatedStudent.id ? updatedStudent : student))
      );

      setIsEditStudentDialogOpen(false);
      setEditStudent(null);
    } catch (error) {
      setEditStudentError(
        error instanceof Error
          ? error.message
          : "Unable to update student. Please try again."
      );
    } finally {
      setIsUpdatingStudent(false);
    }
  }

  const filteredStudents = students
    .filter((student) => {
      if (levelFilter !== "all" && student.grade !== levelFilter) return false;
      if (sectionFilter !== "all" && student.section !== sectionFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          student.name.toLowerCase().includes(q) ||
          student.lrn.toLowerCase().includes(q) ||
          `${student.grade}-${student.section}`.toLowerCase().includes(q)
        );
      }

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Calculate registry insights
  const registryInsights = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status === "Active").length;
    const inactiveStudents = students.filter((s) => s.status === "Inactive").length;
    const pendingStudents = students.filter((s) => s.status === "Pending").length;
    const totalSections = sections.length;
    const totalLevels = levels.length;

    // Count students per grade with status breakdown
    const gradeMap = new Map<string, { total: number; active: number; inactive: number; pending: number }>();

    // Initialize with all levels (even those with 0 students)
    levels.forEach((level) => {
      gradeMap.set(level.name, { total: 0, active: 0, inactive: 0, pending: 0 });
    });

    // Add student counts
    students.forEach((s) => {
      const existing = gradeMap.get(s.grade) || { total: 0, active: 0, inactive: 0, pending: 0 };
      existing.total += 1;
      if (s.status === "Active") existing.active += 1;
      else if (s.status === "Inactive") existing.inactive += 1;
      else if (s.status === "Pending") existing.pending += 1;
      gradeMap.set(s.grade, existing);
    });

    // Count students per section with status breakdown
    const sectionMap = new Map<string, { grade: string; section: string; total: number; active: number; inactive: number; pending: number }>();

    // Initialize with all sections (even those with 0 students)
    sections.forEach((section) => {
      const levelName = levels.find((l) => l.id === section.levelId)?.name || "Unassigned";
      const key = `${levelName}-${section.name}`;
      sectionMap.set(key, { grade: levelName, section: section.name, total: 0, active: 0, inactive: 0, pending: 0 });
    });

    // Add student counts
    students.forEach((s) => {
      const key = `${s.grade}-${s.section}`;
      const existing = sectionMap.get(key) || { grade: s.grade, section: s.section, total: 0, active: 0, inactive: 0, pending: 0 };
      existing.total += 1;
      if (s.status === "Active") existing.active += 1;
      else if (s.status === "Inactive") existing.inactive += 1;
      else if (s.status === "Pending") existing.pending += 1;
      sectionMap.set(key, existing);
    });

    // Convert to sorted arrays (by total count descending)
    const gradeBreakdown = Array.from(gradeMap.entries())
      .map(([grade, data]) => ({ grade, ...data }))
      .sort((a, b) => b.total - a.total);

    const sectionBreakdown = Array.from(sectionMap.values())
      .sort((a, b) => b.total - a.total);

    // Find top grade by student count (only those with students)
    const gradesWithStudents = gradeBreakdown.filter((g) => g.total > 0);
    const topGrade = gradesWithStudents.length > 0
      ? { name: gradesWithStudents[0].grade, count: gradesWithStudents[0].total }
      : { name: "N/A", count: 0 };

    // Find top section by student count (only those with students)
    const sectionsWithStudents = sectionBreakdown.filter((s) => s.total > 0);
    const topSection = sectionsWithStudents.length > 0
      ? { name: sectionsWithStudents[0].section, grade: sectionsWithStudents[0].grade, count: sectionsWithStudents[0].total }
      : { name: "N/A", grade: "", count: 0 };

    return {
      totalStudents,
      activeStudents,
      inactiveStudents,
      pendingStudents,
      totalSections,
      totalLevels,
      topGrade,
      topSection,
      gradeBreakdown,
      sectionBreakdown,
    };
  }, [students, sections, levels]);

  const addStudentSectionsForSelectedLevel = addStudentLevelName
    ? getSectionsForLevelName(addStudentLevelName)
    : [];
  const shouldShowAddStudentSectionField =
    addStudentSectionsForSelectedLevel.length > 0;
  const editStudentSectionsForSelectedLevel = editStudentLevelName
    ? getSectionsForLevelName(editStudentLevelName)
    : [];
  const shouldShowEditStudentSectionField =
    editStudentSectionsForSelectedLevel.length > 0;

  function handleDownloadTemplateClick() {
    if (typeof window === "undefined") return;

    const headers = [
      "ID / LRN",
      "First Name",
      "Middle Name",
      "Last Name",
      "Grade / Level",
      "Section",
      "Student Email",
      "Guardian First Name",
      "Guardian Middle Name",
      "Guardian Last Name",
      "Guardian Phone",
      "Guardian Email",
    ];

    const csv = `${headers.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "student-import-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
    <div className="flex-1 flex flex-col space-y-6 min-h-0 overflow-y-auto hide-scrollbar px-4 py-4 sm:px-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        {/* Title and Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Title */}
          <div className="flex items-start gap-3 shrink-0">
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Student Registry</h1>
              <p className="text-sm text-muted-foreground">
                Central record of enrolled students, organized by grade and section.
              </p>
              {studentsError && (
                <p className="mt-1 text-xs text-red-600">{studentsError}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={() => setIsBulkImportDialogOpen(true)}
            >
              Bulk Import
            </Button>

            {/* Export QR Codes Dropdown */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-sm inline-flex items-center gap-1.5"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={isExporting || students.length === 0}
              >
                <Download className="w-4 h-4" />
                {isExporting ? "Exporting..." : "Export QR"}
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>

              {isExportMenuOpen && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsExportMenuOpen(false)}
                  />

                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-1 w-52 bg-card rounded-lg shadow-lg border border-border py-1 z-20">
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted flex items-center gap-3"
                      onClick={() => void handleExportQrCodes("excel")}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="font-medium">Excel (.xlsx)</div>
                        <div className="text-xs text-muted-foreground">Spreadsheet with QR images</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted flex items-center gap-3"
                      onClick={() => void handleExportQrCodes("word")}
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-medium">Word (.docx)</div>
                        <div className="text-xs text-muted-foreground">Printable ID cards</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Manage Dropdown */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-sm inline-flex items-center gap-1.5"
                onClick={() => setIsManageMenuOpen(!isManageMenuOpen)}
              >
                <Settings className="w-4 h-4" />
                Manage
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>

              {isManageMenuOpen && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsManageMenuOpen(false)}
                  />

                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-1 w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-20">
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted flex items-center gap-3"
                      onClick={() => {
                        setIsLevelDialogOpen(true);
                        setIsManageMenuOpen(false);
                      }}
                    >
                      <Layers className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">Levels</div>
                        <div className="text-xs text-muted-foreground">Grade levels & years</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted flex items-center gap-3"
                      onClick={() => {
                        setIsSectionDialogOpen(true);
                        setIsManageMenuOpen(false);
                      }}
                    >
                      <LayoutGrid className="w-4 h-4 text-purple-500" />
                      <div>
                        <div className="font-medium">Sections</div>
                        <div className="text-xs text-muted-foreground">Class sections</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
              onClick={() => {
                setAddStudentError(null);
                setAddStudentLevelName("");
                setAddStudentSectionName("");
                setAddStudentStatus("Active");
                setIsAddStudentDialogOpen(true);
              }}
            >
              + Add Student
            </Button>
          </div>
        </div>
      </div>

      {/* Persistent credentials banner - shows outside the dialog so users don't lose access */}
      {!isBulkImportDialogOpen &&
        (studentCredentialsForDownload.length > 0 ||
          guardianCredentialsForDownload.length > 0) && (
          <Alert className="border border-emerald-200 bg-emerald-50 mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <AlertTitle className="text-sm font-medium text-emerald-800">
                    Login credentials available
                  </AlertTitle>
                  <AlertDescription className="text-xs text-emerald-700">
                    {studentCredentialsForDownload.length} student account
                    {studentCredentialsForDownload.length === 1 ? "" : "s"} and{" "}
                    {guardianCredentialsForDownload.length} parent account
                    {guardianCredentialsForDownload.length === 1 ? "" : "s"} were created.
                    Download the CSV files to distribute the temporary passwords.
                  </AlertDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
                {studentCredentialsForDownload.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => {
                      const headers = ["Student Name", "Email", "Temporary Password"];
                      const rows = studentCredentialsForDownload.map((cred) => [
                        cred.studentName,
                        cred.email,
                        cred.temporaryPassword,
                      ]);
                      downloadCsvFile(`student-credentials-${Date.now()}.csv`, headers, rows);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Student credentials
                  </Button>
                )}
                {guardianCredentialsForDownload.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => {
                      const headers = [
                        "Guardian Name",
                        "Email",
                        "Temporary Password",
                        "Linked Students",
                      ];
                      const rows = guardianCredentialsForDownload.map((cred) => [
                        cred.guardianName,
                        cred.email,
                        cred.temporaryPassword,
                        cred.linkedStudents.join("; "),
                      ]);
                      downloadCsvFile(`guardian-credentials-${Date.now()}.csv`, headers, rows);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Parent credentials
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                  onClick={clearCredentialsBanner}
                  aria-label="Dismiss banner"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Alert>
        )}

      {/* Tabs for Students and Parents */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="students" className="gap-2">
            <Users className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="parents" className="gap-2">
            <UsersRound className="h-4 w-4" />
            Parents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="flex-1 flex flex-col space-y-6 min-h-0 mt-0">
      {/* Registry Insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          className="border-border/50 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
          onClick={() => setActiveInsightDialog("total")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Total Students</p>
                <p className="text-xl font-bold text-foreground">{registryInsights.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-border/50 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
          onClick={() => setActiveInsightDialog("active")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Active Students</p>
                <p className="text-xl font-bold text-foreground">
                  {registryInsights.activeStudents}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({registryInsights.totalStudents > 0
                      ? Math.round((registryInsights.activeStudents / registryInsights.totalStudents) * 100)
                      : 0}%)
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-border/50 shadow-sm cursor-pointer hover:border-purple-300 hover:shadow-md transition-all"
          onClick={() => setActiveInsightDialog("grade")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Most Populated Grade</p>
                <p className="text-xl font-bold text-foreground truncate">
                  {registryInsights.topGrade.name}
                  {registryInsights.topGrade.count > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({registryInsights.topGrade.count})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-border/50 shadow-sm cursor-pointer hover:border-amber-300 hover:shadow-md transition-all"
          onClick={() => setActiveInsightDialog("section")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Most Populated Section</p>
                <p className="text-xl font-bold text-foreground truncate">
                  {registryInsights.topSection.name}
                  {registryInsights.topSection.count > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({registryInsights.topSection.count})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col w-full border-border shadow-sm max-h-[calc(100vh-280px)]">
        <CardHeader className="border-b border-gray-50 pb-4 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Student List</CardTitle>
              <CardDescription>
                {filteredStudents.length} of {students.length} students shown.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full">
              <div className="flex gap-2 flex-col sm:flex-row w-full">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-full sm:min-w-[140px] pl-3 pr-3 py-2 text-sm border border-border rounded-full bg-card text-muted-foreground shadow-sm">
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {levelOptions.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-full sm:min-w-[140px] pl-3 pr-3 py-2 text-sm border border-border rounded-full bg-card text-muted-foreground shadow-sm">
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {sectionOptions.map((section) => (
                      <SelectItem key={section} value={section}>
                        Section {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, LRN, or section..."
                className="w-full sm:w-64 px-3 py-2 text-sm border border-border rounded-full bg-card text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
              />
            </div>
          </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <Table className="w-full min-w-[640px]">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted">
                  <TableHead className="font-bold text-primary bg-muted">Student Name</TableHead>
                  <TableHead className="font-bold text-primary bg-muted">Level / Year</TableHead>
                  <TableHead className="font-bold text-primary bg-muted">Section</TableHead>
                  <TableHead className="font-bold text-primary bg-muted">LRN / ID</TableHead>
                  <TableHead className="text-right font-bold text-primary bg-muted">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingStudents ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Loading students...
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer transition-all duration-150 hover:bg-card hover:shadow-sm hover:-translate-y-0.5 hover:border-border/50"
                      onClick={() => {
                        setEditStudentError(null);
                        setEditStudent(student);
                        setEditStudentLevelName(student.grade);
                        setEditStudentSectionName(student.section || "");
                        setEditStudentStatus(student.status);
                        setIsEditStudentDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-medium text-foreground">
                        {student.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.grade}</TableCell>
                      <TableCell className="text-muted-foreground">{student.section}</TableCell>
                      <TableCell className="text-muted-foreground">{student.lrn}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            student.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                              : student.status === "Inactive"
                              ? "bg-muted text-muted-foreground border-border/60"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/40"
                          }`}
                        >
                          {student.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No students match your filters yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="parents" className="flex-1 flex flex-col min-h-0 mt-0">
          <Card className="flex flex-col w-full border-border shadow-sm max-h-[calc(100vh-280px)]">
            <CardHeader className="border-b border-gray-50 pb-4 shrink-0">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Parent / Guardian List</CardTitle>
                  <CardDescription>
                    {filteredGuardians.length} of {guardians.length} parents shown.
                    {guardiansError && (
                      <span className="text-red-600 ml-2">{guardiansError}</span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
                  <input
                    type="text"
                    value={guardianSearchTerm}
                    onChange={(e) => setGuardianSearchTerm(e.target.value)}
                    placeholder="Search name, email, or linked student..."
                    className="w-full sm:w-72 px-3 py-2 text-sm border border-border rounded-full bg-card text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
                <Table className="w-full min-w-[640px]">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-muted">
                      <TableHead className="font-bold text-primary bg-muted">Parent Name</TableHead>
                      <TableHead className="font-bold text-primary bg-muted">Email</TableHead>
                      <TableHead className="font-bold text-primary bg-muted">Linked Students</TableHead>
                      <TableHead className="text-right font-bold text-primary bg-muted">Status</TableHead>
                      <TableHead className="text-right font-bold text-primary bg-muted w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingGuardians ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Loading parents...
                        </TableCell>
                      </TableRow>
                    ) : filteredGuardians.length > 0 ? (
                      filteredGuardians.map((guardian) => (
                        <TableRow
                          key={guardian.id}
                          className="transition-all duration-150 hover:bg-card hover:shadow-sm"
                        >
                          <TableCell className="font-medium text-foreground">
                            {guardian.fullName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{guardian.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {guardian.linkedStudents.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {guardian.linkedStudents.map((student) => (
                                  <Tooltip key={student.studentId}>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800 cursor-help"
                                      >
                                        {student.studentName}
                                        {student.isPrimary && (
                                          <span className="ml-1 text-amber-500">★</span>
                                        )}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="space-y-1">
                                        <div className="font-medium">{student.grade} - {student.section}</div>
                                        <div className="text-white/80">LRN: {student.lrn}</div>
                                        {student.relationship && (
                                          <div className="text-white/80">Relationship: {student.relationship}</div>
                                        )}
                                        {student.isPrimary && (
                                          <div className="text-amber-300 text-[10px] font-medium">★ Primary Guardian</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60 italic">No linked students</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                guardian.isActive
                                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                                  : "bg-muted text-muted-foreground border-border/60"
                              }`}
                            >
                              {guardian.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditGuardianError(null);
                                setEditGuardian(guardian);
                                setEditGuardianFullName(guardian.fullName);
                                setEditGuardianEmail(guardian.email);
                                setEditGuardianIsActive(guardian.isActive);
                                setIsEditGuardianDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          {guardians.length === 0
                            ? "No parents found. Parents are created when you import students with guardian information."
                            : "No parents match your search."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Edit Guardian Dialog */}
      {isEditGuardianDialogOpen && editGuardian && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate"
          onClick={() => setIsEditGuardianDialogOpen(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-md border border-border/50 dialog-panel-animate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">Edit Parent / Guardian</h2>
                <p className="text-sm text-muted-foreground">
                  Update the parent&apos;s account details.
                </p>
                {editGuardianError && (
                  <p className="mt-1 text-xs text-red-600">{editGuardianError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditGuardianDialogOpen(false)}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleEditGuardianSubmit(e)} className="px-6 pb-5 pt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={editGuardianFullName}
                  onChange={(e) => setEditGuardianFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={editGuardianEmail}
                  onChange={(e) => setEditGuardianEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Status</label>
                <Select
                  value={editGuardianIsActive ? "active" : "inactive"}
                  onValueChange={(value) => setEditGuardianIsActive(value === "active")}
                >
                  <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editGuardian.linkedStudents.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Linked Students</label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-lg bg-muted/30">
                    {editGuardian.linkedStudents.map((student) => (
                      <span
                        key={student.studentId}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800"
                      >
                        {student.studentName}
                        {student.relationship && (
                          <span className="ml-1 text-muted-foreground">({student.relationship})</span>
                        )}
                        {student.isPrimary && (
                          <span className="ml-1 text-amber-500">★</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Student links are managed through the student import process.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditGuardianDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#1B4D3E] text-white hover:bg-[#163e32]"
                  disabled={isUpdatingGuardian}
                >
                  {isUpdatingGuardian ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLevelDialogOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate"
          onClick={() => setIsLevelDialogOpen(false)}
        >
          <div
          className="bg-card rounded-2xl shadow-xl w-full max-w-lg border border-border/50 dialog-panel-animate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">Manage Levels</h2>
                <p className="text-sm text-muted-foreground">
                  Add new basic-education grades or college year levels.
                </p>
                {levelsSectionsError && (
                  <p className="mt-1 text-xs text-red-600">{levelsSectionsError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsLevelDialogOpen(false)}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-5 pt-4 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">New level / year</p>
                <p className="text-xs text-muted-foreground">
                  Examples: <span className="font-medium">Grade 11</span>, <span className="font-medium">BSIT 1st Yr</span>, <span className="font-medium">BSED 3rd Yr</span>.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    placeholder="e.g. Grade 11 or BSIT 1st Yr"
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                  <Button
                    type="button"
                    className="text-sm px-4 bg-[#1B4D3E] text-white hover:bg-[#163e32]"
                    disabled={isSavingLevelOrSection}
                    onClick={() => {
                      void handleAddLevelClick();
                    }}
                  >
                    Add level
                  </Button>
                </div>
                {levelOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {levels.map((level) => (
                      <span
                        key={level.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[11px]"
                      >
                        {level.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-border/50 pt-4 mt-2">
                <p className="text-sm font-semibold text-foreground">Edit level / year</p>
                <p className="text-xs text-muted-foreground">
                  Choose a level and update its name.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Level / year</label>
                    <Select
                      value={editLevelId}
                      onValueChange={(id: string) => {
                        setEditLevelId(id);
                        const selected = levels.find((level) => level.id === id) ?? null;
                        setEditLevelName(selected ? selected.name : "");
                      }}
                    >
                      <SelectTrigger className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">New name</label>
                    <input
                      type="text"
                      value={editLevelName}
                      onChange={(e) => setEditLevelName(e.target.value)}
                      placeholder="Enter new level name"
                      className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                  <Button
                    type="button"
                    className="w-full sm:w-auto text-xs px-4 bg-[#1B4D3E] text-white hover:bg-[#163e32]"
                    disabled={
                      isSavingLevelOrSection || !editLevelId || !editLevelName.trim()
                    }
                    onClick={() => {
                      void handleUpdateLevelClick();
                    }}
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto text-xs px-4 border-red-200 text-red-700 hover:bg-red-50"
                    disabled={isSavingLevelOrSection || !editLevelId}
                    onClick={() => {
                      void handleDisableLevelClick();
                    }}
                  >
                    {(() => {
                      const selected = levels.find((level) => level.id === editLevelId);
                      if (!selected) return "Toggle status";
                      return selected.isActive ? "Set inactive" : "Set active";
                    })()}
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 pt-3 border-t border-border/50 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="text-sm px-4"
                onClick={() => setIsLevelDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEditStudentDialogOpen && editStudent && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate"
          onClick={() => {
            setIsEditStudentDialogOpen(false);
            setEditStudent(null);
          }}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-xl border border-border/50 dialog-panel-animate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">Edit Student</h2>
                <p className="text-sm text-muted-foreground">
                  Update the student details below. Changes will be saved to the registry.
                </p>
                {editStudentError && (
                  <p className="mt-1 text-xs text-red-600">{editStudentError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditStudentDialogOpen(false);
                  setEditStudent(null);
                }}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close edit student dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="px-6 pb-5 pt-4 space-y-5 max-h-[70vh] overflow-y-auto hide-scrollbar"
              onSubmit={(event) => {
                void handleEditStudentSubmit(event);
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">Full Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={editStudent.name}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">Level / Year</label>
                  <Select
                    value={editStudentLevelName || editStudent.grade}
                    onValueChange={(value: string) => {
                      setEditStudentLevelName(value);
                    }}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {levelOptions.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="level"
                    value={editStudentLevelName || editStudent.grade}
                  />
                </div>
                {shouldShowEditStudentSectionField && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-muted-foreground">Section</label>
                    <Select
                      value={editStudentSectionName || editStudent.section || ""}
                      onValueChange={(value: string) => {
                        setEditStudentSectionName(value);
                      }}
                    >
                      <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {editStudentSectionsForSelectedLevel.map((section) => (
                          <SelectItem key={section.id} value={section.name}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="section"
                      value={editStudentSectionName || editStudent.section || ""}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    LRN / Student ID <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    name="lrn"
                    type="text"
                    inputMode="numeric"
                    defaultValue={editStudent.lrn}
                    placeholder="e.g. 2025-0001"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Guardian Phone <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    name="guardianPhone"
                    type="tel"
                    defaultValue={editStudent.guardianPhone ?? ""}
                    placeholder="e.g. 09XXXXXXXXX"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Guardian Email <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    name="guardianEmail"
                    type="email"
                    defaultValue={editStudent.guardianEmail ?? ""}
                    placeholder="e.g. parent@example.com"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">Status</label>
                  <Select
                    value={editStudentStatus || editStudent.status}
                    onValueChange={(value: StudentStatus) => {
                      setEditStudentStatus(value);
                    }}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="status"
                    value={editStudentStatus || editStudent.status}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="text-sm px-4"
                  onClick={() => {
                    setIsEditStudentDialogOpen(false);
                    setEditStudent(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingStudent}
                  className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isUpdatingStudent ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSectionDialogOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate"
          onClick={() => setIsSectionDialogOpen(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-lg border border-border/50 dialog-panel-animate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">Manage Sections</h2>
                <p className="text-sm text-muted-foreground">
                  Add new sections for your levels and years.
                </p>
                {levelsSectionsError && (
                  <p className="mt-1 text-xs text-red-600">{levelsSectionsError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSectionDialogOpen(false)}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-5 pt-4 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">New section</p>
                <p className="text-xs text-muted-foreground">
                  Examples: <span className="font-medium">A</span>, <span className="font-medium">STEM-1</span>, <span className="font-medium">BSIT-2A</span>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Level / year (optional)</label>
                    <Select value={newSectionLevelId} onValueChange={setNewSectionLevelId}>
                      <SelectTrigger className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue placeholder="No specific level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No specific level</SelectItem>
                        {levels.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Section name</label>
                    <input
                      type="text"
                      value={newSection}
                      onChange={(e) => setNewSection(e.target.value)}
                      placeholder="e.g. A, STEM-1"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>

                <div className="flex sm:justify-end">
                  <Button
                    type="button"
                    className="w-full sm:w-auto text-sm px-4 bg-[#1B4D3E] text-white hover:bg-[#163e32]"
                    disabled={isSavingLevelOrSection}
                    onClick={() => {
                      void handleAddSectionClick();
                    }}
                  >
                    Add section
                  </Button>
                </div>
                {sectionOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sectionOptions.map((section) => (
                      <span
                        key={section}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[11px]"
                      >
                        Section {section}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-border/50 pt-4 mt-2">
                <p className="text-sm font-semibold text-foreground">Edit section</p>
                <p className="text-xs text-muted-foreground">
                  Choose a section and update its name and level.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Section</label>
                    <Select
                      value={editSectionId}
                      onValueChange={(id: string) => {
                        setEditSectionId(id);
                        const selected = sections.find((section) => section.id === id) ?? null;
                        setEditSectionName(selected ? selected.name : "");
                        setEditSectionLevelId(
                          selected && selected.levelId ? selected.levelId : "__none__",
                        );
                      }}
                    >
                      <SelectTrigger className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">New name</label>
                    <input
                      type="text"
                      value={editSectionName}
                      onChange={(e) => setEditSectionName(e.target.value)}
                      placeholder="Enter new section name"
                      className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div className="sm:w-1/2 space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Level / year (optional)</label>
                    <Select
                      value={editSectionLevelId}
                      onValueChange={setEditSectionLevelId}
                    >
                      <SelectTrigger className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue placeholder="No specific level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No specific level</SelectItem>
                        {levels.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                    <Button
                      type="button"
                      className="w-full sm:w-auto text-xs px-4 bg-[#1B4D3E] text-white hover:bg-[#163e32]"
                      disabled={isSavingLevelOrSection || !editSectionId || !editSectionName.trim()}
                      onClick={() => {
                        void handleUpdateSectionClick();
                      }}
                    >
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto text-xs px-4 border-red-200 text-red-700 hover:bg-red-50"
                      disabled={isSavingLevelOrSection || !editSectionId}
                      onClick={() => {
                        void handleDisableSectionClick();
                      }}
                    >
                      Disable section
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 pt-3 border-t border-border/50 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="text-sm px-4"
                onClick={() => setIsSectionDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAddStudentDialogOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate"
          onClick={() => setIsAddStudentDialogOpen(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-xl border border-border/50 dialog-panel-animate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">Add Student</h2>
                <p className="text-sm text-muted-foreground">
                  Capture basic student details. You can map this to Supabase later.
                </p>
                {addStudentError && (
                  <p className="mt-1 text-xs text-red-600">{addStudentError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsAddStudentDialogOpen(false)}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close add student dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="px-6 pb-5 pt-4 space-y-5 max-h-[70vh] overflow-y-auto"
              onSubmit={(event) => {
                void handleAddStudentSubmit(event);
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">Full Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">Level / Year</label>
                  <Select
                    value={addStudentLevelName}
                    onValueChange={(value: string) => {
                      setAddStudentLevelName(value);
                    }}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {levelOptions.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="level" value={addStudentLevelName} />
                </div>
                {shouldShowAddStudentSectionField && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-muted-foreground">Section</label>
                    <Select
                      value={addStudentSectionName}
                      onValueChange={(value: string) => {
                        setAddStudentSectionName(value);
                      }}
                    >
                      <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {addStudentSectionsForSelectedLevel.map((section) => (
                          <SelectItem key={section.id} value={section.name}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="section" value={addStudentSectionName} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    LRN / Student ID <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    name="lrn"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 2025-0001"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Guardian Phone <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    name="guardianPhone"
                    type="tel"
                    placeholder="e.g. 09XXXXXXXXX"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Guardian Email <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
                  </label>
                  <input
                    name="guardianEmail"
                    type="email"
                    placeholder="e.g. parent@example.com"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">Status</label>
                  <Select
                    value={addStudentStatus}
                    onValueChange={(value: StudentStatus) => {
                      setAddStudentStatus(value);
                    }}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="status" value={addStudentStatus} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="text-sm px-4"
                  onClick={() => setIsAddStudentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingStudent}
                  className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSavingStudent ? "Saving..." : "Save Student"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkImportDialogOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm dialog-backdrop-animate"
          onClick={() => {
            // Block closing while import is in progress
            if (isImportingStudents) return;
            resetBulkImportState(true); // preserve credentials
            setIsBulkImportDialogOpen(false);
          }}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-xl border border-border/50 dialog-panel-animate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border/50">
              <div>
                <h2 className="text-lg font-bold text-foreground">Bulk Import Students</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file containing the official student list. This is UI-only for now.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Block closing while import is in progress
                  if (isImportingStudents) return;
                  resetBulkImportState(true); // preserve credentials
                  setIsBulkImportDialogOpen(false);
                }}
                className={`text-muted-foreground/70 hover:text-muted-foreground ${
                  isImportingStudents ? "opacity-40 cursor-not-allowed" : ""
                }`}
                aria-label="Close bulk import dialog"
                disabled={isImportingStudents}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="px-6 pb-5 pt-4"
              onSubmit={(e) => {
                void handleBulkImportSubmit(e);
              }}
            >
              <div className="space-y-5 max-h-[70vh] overflow-y-auto hide-scrollbar">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-muted-foreground">CSV file</label>
                  <label
                    htmlFor="bulk-import-file"
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/60 px-4 py-6 text-center transition-colors ${
                      isImportingStudents
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer hover:border-[#1B4D3E]/40 hover:bg-card"
                    }`}
                    aria-disabled={isImportingStudents}
                  >
                    <span className="text-sm font-medium text-foreground">Click to choose file or drag and drop</span>
                    <span className="text-xs text-muted-foreground">Accepted format: .csv</span>
                    {bulkFileName ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        File selected: {bulkFileName}
                      </span>
                    ) : (
                      <span className="mt-1 text-xs text-muted-foreground/70">No file selected yet</span>
                    )}
                    <input
                      id="bulk-import-file"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      disabled={isImportingStudents}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setBulkFileName(file ? file.name : null);
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Required columns</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>
                      <span className="font-medium">ID / LRN</span> – unique student identifier
                    </li>
                    <li>
                      <span className="font-medium">First Name</span>
                    </li>
                    <li>
                      <span className="font-medium">Last Name</span>
                    </li>
                    <li>
                      <span className="font-medium">Grade / Level</span> – e.g. "Grade 9", "BSIT 1st Yr"
                    </li>
                    <li>
                      <span className="font-medium">Section</span> – e.g. "A", "STEM-1"
                    </li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    Optional columns: Middle Name, Student Email (creates student login), Guardian First Name, Guardian Middle Name, Guardian Last Name, Guardian Phone, and Guardian Email (creates parent login and links to student).
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <p className="text-muted-foreground">Need a starting point? Download a CSV template.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-3 text-xs border-border"
                    onClick={handleDownloadTemplateClick}
                  >
                    Export template
                  </Button>
                </div>

                {bulkImportStatus === "loading" && (
                  <Alert className="mt-3 border text-xs border-[#1B4D3E]/30 bg-[#1B4D3E]/5">
                    <div className="flex items-start gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1B4D3E] mt-0.5 shrink-0" />
                      <div className="space-y-0.5">
                        <AlertTitle className="text-xs font-medium text-[#1B4D3E]">
                          Importing students...
                        </AlertTitle>
                        <AlertDescription className="text-[11px] leading-snug text-[#1B4D3E]/80">
                          Please wait. This may take a moment. Do not close this dialog until the
                          import completes.
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                )}

                {bulkImportStatus === "success" && bulkImportMessage && (
                  <Alert className="mt-3 border text-xs border-emerald-200 bg-emerald-50">
                    <div className="space-y-0.5">
                      <AlertTitle className="text-xs font-medium text-emerald-800">
                        Import completed
                      </AlertTitle>
                      <AlertDescription className="text-[11px] leading-snug text-emerald-700">
                        {bulkImportMessage}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                {bulkImportStatus === "error" && bulkImportMessage && (
                  <Alert variant="destructive" className="mt-3 border text-xs">
                    <div className="space-y-0.5">
                      <AlertTitle className="text-xs font-medium">Import issue</AlertTitle>
                      <AlertDescription className="text-[11px] leading-snug">
                        {bulkImportMessage}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                {bulkImportErrors.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-2">
                    <p className="font-semibold text-amber-900">
                      Some rows need your attention
                    </p>

                    <p className="text-[11px] text-amber-900/80">
                      We couldn't import a few rows because their level or section doesn't exist yet.
                      Fix the issues in your CSV or create the missing levels/sections, then try the
                      import again.
                    </p>

                    <ul className="max-h-32 overflow-y-auto hide-scrollbar space-y-0.5 text-[11px]">
                      {bulkImportErrors.map((error) => (
                        <li key={`${error.rowNumber}-${error.message}`}>
                          <span className="font-medium">Row {error.rowNumber}</span> – {error.message}
                        </li>
                      ))}
                    </ul>

                    <p className="text-[11px] text-amber-900/70">
                      Tip: Make sure the <span className="font-medium">Grade / Level</span> and
                      <span className="font-medium"> Section</span> values in your CSV exactly match your
                      configured Levels and Sections.
                    </p>
                  </div>
                )}

                {(studentCredentialsForDownload.length > 0 ||
                  guardianCredentialsForDownload.length > 0) && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/60 px-3 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground">
                      Need another copy? You can re-download the latest login credentials here.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {studentCredentialsForDownload.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs"
                          onClick={() => {
                            const headers = ["Student Name", "Email", "Temporary Password"];
                            const rows = studentCredentialsForDownload.map((cred) => [
                              cred.studentName,
                              cred.email,
                              cred.temporaryPassword,
                            ]);
                            downloadCsvFile(
                              `student-credentials-${Date.now()}.csv`,
                              headers,
                              rows
                            );
                          }}
                        >
                          Download student credentials CSV
                        </Button>
                      )}
                      {guardianCredentialsForDownload.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs"
                          onClick={() => {
                            const headers = [
                              "Guardian Name",
                              "Email",
                              "Temporary Password",
                              "Linked Students",
                            ];
                            const rows = guardianCredentialsForDownload.map((cred) => [
                              cred.guardianName,
                              cred.email,
                              cred.temporaryPassword,
                              cred.linkedStudents.join("; "),
                            ]);
                            downloadCsvFile(
                              `guardian-credentials-${Date.now()}.csv`,
                              headers,
                              rows
                            );
                          }}
                        >
                          Download parent credentials CSV
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <p className="pt-2 text-[11px] text-muted-foreground text-right">
                  When the import finishes, you'll be able to download a CSV with student and guardian
                  login credentials.
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-sm px-4"
                    disabled={isImportingStudents}
                    onClick={() => {
                      resetBulkImportState(true); // preserve credentials
                      setIsBulkImportDialogOpen(false);
                    }}
                  >
                    {bulkImportStatus === "success" ? "Close" : "Cancel"}
                  </Button>
                  {bulkImportStatus !== "success" && (
                    <Button
                      type="submit"
                      className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm"
                      disabled={!bulkFileName || isImportingStudents}
                    >
                      {isImportingStudents ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Continue Import"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Insight Detail Dialogs */}
      {activeInsightDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setActiveInsightDialog(null)}
          />
          <div className="relative bg-card rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                {activeInsightDialog === "total" && (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Total Students</h3>
                      <p className="text-xs text-muted-foreground">Breakdown by grade level</p>
                    </div>
                  </>
                )}
                {activeInsightDialog === "active" && (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                      <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Student Status</h3>
                      <p className="text-xs text-muted-foreground">Active, inactive & pending breakdown</p>
                    </div>
                  </>
                )}
                {activeInsightDialog === "grade" && (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Students by Grade</h3>
                      <p className="text-xs text-muted-foreground">All grade levels ranked by enrollment</p>
                    </div>
                  </>
                )}
                {activeInsightDialog === "section" && (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                      <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Students by Section</h3>
                      <p className="text-xs text-muted-foreground">All sections ranked by enrollment</p>
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setActiveInsightDialog(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Dialog Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Total Students Dialog */}
              {activeInsightDialog === "total" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{registryInsights.totalStudents}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{registryInsights.gradeBreakdown.length}</p>
                      <p className="text-xs text-muted-foreground">Grades</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{registryInsights.sectionBreakdown.length}</p>
                      <p className="text-xs text-muted-foreground">Sections</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Students per Grade</h4>
                    <div className="space-y-2">
                      {registryInsights.gradeBreakdown.map((item) => (
                        <div key={item.grade} className="flex items-center gap-3">
                          <span className="text-sm text-foreground w-24 truncate">{item.grade}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${registryInsights.totalStudents > 0 ? (item.total / registryInsights.totalStudents) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-foreground w-12 text-right">{item.total}</span>
                        </div>
                      ))}
                      {registryInsights.gradeBreakdown.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No student data available</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Active Students Dialog */}
              {activeInsightDialog === "active" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{registryInsights.activeStudents}</p>
                      <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Active</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{registryInsights.inactiveStudents}</p>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70">Inactive</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{registryInsights.pendingStudents}</p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Pending</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Status by Grade</h4>
                    <div className="space-y-3">
                      {registryInsights.gradeBreakdown.map((item) => (
                        <div key={item.grade} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{item.grade}</span>
                            <span className="text-xs text-muted-foreground">{item.total} students</span>
                          </div>
                          <div className="flex gap-1 h-2">
                            {item.active > 0 && (
                              <div
                                className="bg-emerald-500 rounded-full"
                                style={{ width: `${(item.active / item.total) * 100}%` }}
                                title={`Active: ${item.active}`}
                              />
                            )}
                            {item.inactive > 0 && (
                              <div
                                className="bg-red-500 rounded-full"
                                style={{ width: `${(item.inactive / item.total) * 100}%` }}
                                title={`Inactive: ${item.inactive}`}
                              />
                            )}
                            {item.pending > 0 && (
                              <div
                                className="bg-amber-500 rounded-full"
                                style={{ width: `${(item.pending / item.total) * 100}%` }}
                                title={`Pending: ${item.pending}`}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {registryInsights.gradeBreakdown.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No student data available</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Grade Breakdown Dialog */}
              {activeInsightDialog === "grade" && (
                <div className="space-y-3">
                  {registryInsights.gradeBreakdown.map((item, index) => (
                    <div
                      key={item.grade}
                      className={`flex items-center gap-3 p-3 rounded-lg ${index === 0 ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800" : "bg-muted/50"}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.grade}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.active} active, {item.inactive} inactive, {item.pending} pending
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{item.total}</p>
                        <p className="text-xs text-muted-foreground">
                          {registryInsights.totalStudents > 0
                            ? Math.round((item.total / registryInsights.totalStudents) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {registryInsights.gradeBreakdown.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No grade data available</p>
                  )}
                </div>
              )}

              {/* Section Breakdown Dialog */}
              {activeInsightDialog === "section" && (
                <div className="space-y-3">
                  {registryInsights.sectionBreakdown.map((item, index) => (
                    <div
                      key={`${item.grade}-${item.section}`}
                      className={`flex items-center gap-3 p-3 rounded-lg ${index === 0 ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-muted/50"}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.section}</p>
                        <p className="text-xs text-muted-foreground">{item.grade}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{item.total}</p>
                        <p className="text-xs text-muted-foreground">
                          {registryInsights.totalStudents > 0
                            ? Math.round((item.total / registryInsights.totalStudents) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {registryInsights.sectionBreakdown.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No section data available</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
