import Dexie, { type Table } from "dexie";
import type { EventSessionConfig } from "@/modules/sems/domain/types";

export interface ScannerEventRecord {
  id: string;
  title: string;
  venue: string | null;
  timeRange: string;
  startDate: string;
  endDate: string;
  sessionConfig: EventSessionConfig;
  scannerUserId: string;
  downloadedAt: string;
}

export interface AllowedStudentRecord {
  id?: number;
  eventId: string;
  studentId: string;
  qrHash: string;
  fullName: string;
  lrn: string;
  grade: string;
  section: string;
}

export type ScanStatus = "PRESENT" | "LATE" | "DENIED" | "DUPLICATE";

export interface ScanQueueRecord {
  id: string;
  eventId: string;
  studentId: string;
  qrHash: string;
  scannedAt: string;
  status: ScanStatus;
  reason: string | null;
  sessionId: string | null;
  sessionName: string | null;
  sessionDirection: "in" | "out" | null;
  syncStatus: "pending" | "synced" | "failed";
  createdAt: string;
}

class ScannerDb extends Dexie {
  scannerEvents!: Table<ScannerEventRecord, string>;
  allowedStudents!: Table<AllowedStudentRecord, number>;
  scanQueue!: Table<ScanQueueRecord, string>;

  constructor() {
    super("semsScanner");

    // Version 1: Initial schema
    this.version(1).stores({
      scannerEvents: "id, startDate, endDate, scannerUserId",
      allowedStudents:
        "++id, eventId, studentId, qrHash, [eventId+qrHash], [eventId+studentId]",
      scanQueue: "id, eventId, studentId, qrHash, scannedAt, syncStatus",
    });

    // Version 2: Add compound index for session-based duplicate checking
    // This allows efficient queries like: "has this student scanned for this session?"
    this.version(2).stores({
      scannerEvents: "id, startDate, endDate, scannerUserId",
      allowedStudents:
        "++id, eventId, studentId, qrHash, [eventId+qrHash], [eventId+studentId]",
      scanQueue:
        "id, eventId, studentId, qrHash, scannedAt, syncStatus, sessionId, [eventId+sessionId+studentId]",
    });
  }
}

export const scannerDb = new ScannerDb();
