"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Users, X, FileSpreadsheet, FileText, Download, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [isExporting, setIsExporting] = useState(false);

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

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      const fileInput = form.querySelector<HTMLInputElement>("#bulk-import-file");
      const file = fileInput?.files?.[0] ?? null;

      if (!file) {
        setBulkImportMessage("Please choose a CSV file before continuing.");
        setIsImportingStudents(false);
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
            };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.success || !body.data?.summary) {
        const message = body?.error?.message ?? "Unable to import students. Please try again.";
        setBulkImportMessage(message);
        setIsImportingStudents(false);
        return;
      }

      const summary = body.data.summary;
      const imported = body.data.students ?? [];

      // All-or-nothing: if any row failed, do not insert any students
      if (summary.failedCount > 0) {
        setBulkImportMessage(
          "Some rows reference levels/sections that dont exist yet. Fix them in the CSV or create the missing levels/sections, then try again."
        );
        setBulkImportErrors(body.data.errors ?? []);
        setIsImportingStudents(false);
        return;
      }

      if (imported.length > 0) {
        setStudents((previous: StudentRecord[]) => [...imported, ...previous]);
      }

      const message = `Imported ${summary.importedCount} of ${summary.totalRows} rows. ${summary.failedCount} failed.`;
      setBulkImportMessage(message);

      // Briefly show the message, then close the dialog
      setTimeout(() => {
        setIsBulkImportDialogOpen(false);
        setBulkFileName(null);
        setBulkImportMessage(null);
        setBulkImportErrors([]);
      }, 1200);
    } catch (error) {
      setBulkImportMessage(
        error instanceof Error ? error.message : "Unable to import students. Please try again."
      );
      setIsImportingStudents(false);
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

  const filteredStudents = students.filter((student) => {
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
  });

  const addStudentSectionsForSelectedLevel = addStudentLevelName
    ? getSectionsForLevelName(addStudentLevelName)
    : [];
  const shouldShowAddStudentSectionField = addStudentSectionsForSelectedLevel.length > 0;
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
      "Last Name",
      "Grade / Level",
      "Section",
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 w-full">
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Registry (SIS)</h1>
            <p className="text-sm text-muted-foreground">
              Central record of enrolled students, organized by grade and section.
            </p>
            {studentsError && (
              <p className="mt-1 text-xs text-red-600">{studentsError}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 w-full lg:w-auto lg:flex-nowrap lg:items-center lg:gap-3 lg:justify-end">
          <Button
            type="button"
            className="bg-card border border-border text-muted-foreground hover:bg-muted text-sm px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto lg:w-auto"
            onClick={() => setIsBulkImportDialogOpen(true)}
          >
            Bulk Import
          </Button>
          
          {/* Export QR Codes Dropdown */}
          <div className="relative w-full sm:w-auto lg:w-auto">
            <Button
              type="button"
              className="bg-card border border-border text-muted-foreground hover:bg-muted text-sm px-4 py-2 rounded-lg shadow-sm inline-flex items-center gap-1.5 w-full"
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
          
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 w-full sm:w-auto lg:flex-nowrap lg:gap-2">
            <Button
              type="button"
              className="bg-card border border-border text-muted-foreground hover:bg-muted text-sm px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto"
              onClick={() => setIsLevelDialogOpen(true)}
            >
              Manage Levels
            </Button>
            <Button
              type="button"
              className="bg-card border border-border text-muted-foreground hover:bg-muted text-sm px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto"
              onClick={() => setIsSectionDialogOpen(true)}
            >
              Manage Sections
            </Button>
          </div>
          <Button
            type="button"
            className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto"
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

      <Card className="flex-1 flex flex-col w-full border-border shadow-sm">
        <CardHeader className="border-b border-gray-50 pb-4">
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
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="font-bold text-primary">Student Name</TableHead>
                  <TableHead className="font-bold text-primary">Level / Year</TableHead>
                  <TableHead className="font-bold text-primary">Section</TableHead>
                  <TableHead className="font-bold text-primary">LRN / ID</TableHead>
                  <TableHead className="text-right font-bold text-primary">Status</TableHead>
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
      </div>

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
          onClick={() => setIsBulkImportDialogOpen(false)}
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
                onClick={() => setIsBulkImportDialogOpen(false)}
                className="text-muted-foreground/70 hover:text-muted-foreground"
                aria-label="Close bulk import dialog"
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
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/60 px-4 py-6 text-center cursor-pointer hover:border-[#1B4D3E]/40 hover:bg-card transition-colors"
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
                    Optional columns such as Guardian Phone and Guardian Email can be added as extra columns in the CSV.
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

                {bulkImportMessage && (
                  <p className="text-xs text-muted-foreground pt-2">{bulkImportMessage}</p>
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

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-sm px-4"
                    onClick={() => setIsBulkImportDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#1B4D3E] text-white hover:bg-[#163e32] text-sm px-4 py-2 rounded-lg shadow-sm"
                    disabled={!bulkFileName || isImportingStudents}
                  >
                    {isImportingStudents ? "Importing..." : "Continue Import"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
