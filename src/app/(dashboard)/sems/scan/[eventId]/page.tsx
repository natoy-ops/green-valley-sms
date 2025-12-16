"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Zap,
  ZapOff,
  User,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  scannerDb,
  type ScannerEventRecord,
  type AllowedStudentRecord,
  type ScanQueueRecord,
  type ScanStatus,
} from "@/core/offline/scanner-db";
import {
  findActiveSession,
  isLateForSession,
} from "@/core/offline/scanner-session-utils";
import { BrowserQRCodeReader } from "@zxing/browser";

// Mock event data
const MOCK_EVENT = {
  id: "evt-1",
  title: "Morning Assembly",
  venue: "Main Grounds",
  timeRange: "07:00 - 08:00 AM",
};

// Mock scanned student data (simulates last scan result)
interface ScannedStudent {
  id: string;
  name: string;
  lrn: string;
  grade: string;
  section: string;
  avatarUrl: string | null;
  status: "success" | "late" | "already_scanned" | "not_allowed";
  message: string;
  scannedAt: string;
}

export default function EventScannerPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const autoStart = searchParams.get("autostart") === "1";

  const [flashOn, setFlashOn] = useState(false);
  const [lastScan, setLastScan] = useState<ScannedStudent | null>(null);
  const [eventRecord, setEventRecord] = useState<ScannerEventRecord | null>(null);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [allowedStudentCount, setAllowedStudentCount] = useState(0);
  const [scanStats, setScanStats] = useState({
    totalScanned: 0,
    totalLate: 0,
    totalDenied: 0,
    totalDuplicates: 0,
  });
  const [isCameraSupported, setIsCameraSupported] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [scannerModeLabel, setScannerModeLabel] = useState<string>("—");
  const [scanFeedbackLabel, setScanFeedbackLabel] = useState<string | null>(null);
  const [scanFeedbackVariant, setScanFeedbackVariant] = useState<
    "success" | "warning" | "info" | "error" | null
  >(null);
  const [scanFeedbackPulseToken, setScanFeedbackPulseToken] = useState(0);
  const [isScanFeedbackPulsing, setIsScanFeedbackPulsing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const lastScanValueRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastDetectTimeRef = useRef<number>(0);
  const detectorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeUseCanvasRef = useRef(true);
  const nativeDetectErrorCountRef = useRef(0);
  const hasFallenBackToZxingRef = useRef(false);
  const scanningModeRef = useRef<"native" | "zxing" | null>(null);
  const zxingReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  // Status styling
  const getStatusStyles = (status: ScannedStudent["status"]) => {
    switch (status) {
      case "success":
        return {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          badgeBg: "bg-emerald-100 text-emerald-800",
        };
      case "late":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: Clock,
          iconColor: "text-amber-600",
          badgeBg: "bg-amber-100 text-amber-800",
        };
      case "already_scanned":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: AlertCircle,
          iconColor: "text-blue-600",
          badgeBg: "bg-blue-100 text-blue-800",
        };
      case "not_allowed":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          icon: XCircle,
          iconColor: "text-red-600",
          badgeBg: "bg-red-100 text-red-800",
        };
    }
  };

  function resolveScanFeedback(scan: {
    status: ScanStatus;
    isRegisteredStudent: boolean;
  }): { label: string; variant: "success" | "warning" | "info" | "error" } {
    if (scan.status === "PRESENT") return { label: "Valid", variant: "success" };
    if (scan.status === "LATE") return { label: "Late", variant: "warning" };
    if (scan.status === "DUPLICATE") return { label: "Duplicate", variant: "info" };
    if (!scan.isRegisteredStudent) return { label: "Invalid QR", variant: "error" };
    return { label: "Denied", variant: "error" };
  }

  useEffect(() => {
    if (scanFeedbackPulseToken === 0) return;
    setIsScanFeedbackPulsing(true);
    const t = window.setTimeout(() => {
      setIsScanFeedbackPulsing(false);
    }, 520);
    return () => {
      window.clearTimeout(t);
    };
  }, [scanFeedbackPulseToken]);

  useEffect(() => {
    let isCancelled = false;

    async function loadResources() {
      if (!eventId) {
        setIsLoadingResources(false);
        setEventRecord(null);
        setAllowedStudentCount(0);
        return;
      }

      setIsLoadingResources(true);

      try {
        const record = await scannerDb.scannerEvents.get(eventId);

        if (isCancelled) return;

        setEventRecord(record ?? null);

        if (record) {
          const count = await scannerDb.allowedStudents.where("eventId").equals(eventId).count();
          if (!isCancelled) {
            setAllowedStudentCount(count);
          }
        } else if (!isCancelled) {
          setAllowedStudentCount(0);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingResources(false);
        }
      }
    }

    void loadResources();

    return () => {
      isCancelled = true;
    };
  }, [eventId]);

  function mapScanStatusToUiStatus(status: ScanStatus): ScannedStudent["status"] {
    if (status === "PRESENT") return "success";
    if (status === "LATE") return "late";
    if (status === "DUPLICATE") return "already_scanned";
    return "not_allowed";
  }

  // buildScanMessage is now handled by buildSessionScanMessage from scanner-session-utils

  function formatScanTimeLabel(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function processScan(rawValue: string) {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    let scanStatus: ScanStatus;
    let reason: string | null = null;
    let studentRecord: AllowedStudentRecord | null = null;
    let activeSessionId: string | null = null;
    let activeSessionName: string | null = null;
    let activeSessionDirection: "in" | "out" | null = null;

    // Query IndexedDB directly to avoid stale closure issues with React state
    const currentEventRecord = eventRecord ?? (await scannerDb.scannerEvents.get(eventId));

    if (!currentEventRecord) {
      scanStatus = "DENIED";
      reason = "Please download event data first.";
    } else {
      // Step 1: Find the active session based on current device time and date
      const sessionResult = findActiveSession(currentEventRecord.sessionConfig);

      if (!sessionResult.isActive || !sessionResult.session) {
        // No active session right now
        scanStatus = "DENIED";
        reason = sessionResult.reason ?? "Scanning is not open at this time.";
      } else {
        // We have an active session
        const activeSession = sessionResult.session;
        activeSessionId = activeSession.id;
        activeSessionName = activeSession.name;
        activeSessionDirection = activeSession.direction;

        // Step 2: Look up the student
        const lookupResult = await scannerDb.allowedStudents
          .where("[eventId+qrHash]")
          .equals([eventId, trimmed])
          .first();

        studentRecord = lookupResult ?? null;

        if (!studentRecord) {
          scanStatus = "DENIED";
          reason = "This student is not registered for this event.";
        } else {
          // Step 3: Check if student already scanned for THIS SESSION (not just the event)
          const existingForSession = await scannerDb.scanQueue
            .where("[eventId+sessionId+studentId]")
            .equals([eventId, activeSessionId, studentRecord.studentId])
            .first();

          if (existingForSession) {
            scanStatus = "DUPLICATE";
            reason = `Already scanned for ${activeSessionName}.`;
          } else {
            // Step 4: Determine PRESENT vs LATE based on session's lateAfter threshold
            const isLate = isLateForSession(activeSession);
            scanStatus = isLate ? "LATE" : "PRESENT";
            reason = null;
          }
        }
      }
    }

    const nowIso = new Date().toISOString();
    const scanId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `scan_${Date.now()}`;

    const studentIdForRow = studentRecord?.studentId ?? "";

    await scannerDb.scanQueue.put({
      id: scanId,
      eventId,
      studentId: studentIdForRow,
      qrHash: trimmed,
      scannedAt: nowIso,
      status: scanStatus,
      reason,
      sessionId: activeSessionId,
      sessionName: activeSessionName,
      sessionDirection: activeSessionDirection,
      syncStatus: "pending",
      createdAt: nowIso,
    });

    const uiStatus = mapScanStatusToUiStatus(scanStatus);
    // Build user-friendly message based on status and session
    const message = reason ?? (
      scanStatus === "PRESENT" ? (activeSessionName ? `On time for ${activeSessionName}` : "On time") :
      scanStatus === "LATE" ? (activeSessionName ? `Late for ${activeSessionName}` : "Late") :
      scanStatus === "DUPLICATE" ? (activeSessionName ? `Already scanned for ${activeSessionName}` : "Already scanned") :
      "Can't scan this student."
    );
    const timeLabel = formatScanTimeLabel(nowIso);

    setLastScan({
      id: studentIdForRow,
      name: studentRecord?.fullName ?? "Unknown student",
      lrn: studentRecord?.lrn ?? "",
      grade: studentRecord?.grade ?? "",
      section: studentRecord?.section ?? "",
      avatarUrl: null,
      status: uiStatus,
      message,
      scannedAt: timeLabel,
    });

    const feedback = resolveScanFeedback({
      status: scanStatus,
      isRegisteredStudent: !!studentRecord,
    });
    setScanFeedbackLabel(feedback.label);
    setScanFeedbackVariant(feedback.variant);
    setScanFeedbackPulseToken((prev) => prev + 1);

    setScanStats((prev) => {
      const next = { ...prev };

      switch (scanStatus) {
        case "PRESENT":
          next.totalScanned += 1;
          break;
        case "LATE":
          next.totalScanned += 1;
          next.totalLate += 1;
          break;
        case "DENIED":
          next.totalDenied += 1;
          break;
        case "DUPLICATE":
          next.totalDuplicates += 1;
          break;
      }

      return next;
    });
  }

  useEffect(() => {
    const hasMedia =
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    setIsCameraSupported(hasMedia);

    // Always start camera when component mounts (if camera is supported)
    if (hasMedia) {
      void startScanning();
    }

    return () => {
      void stopScanning();
    };
  }, []);

  async function stopScanning() {
    isScanningRef.current = false;
    lastScanValueRef.current = null;
    lastScanTimeRef.current = 0;
    lastDetectTimeRef.current = 0;
    nativeUseCanvasRef.current = true;
    nativeDetectErrorCountRef.current = 0;
    hasFallenBackToZxingRef.current = false;
    setScannerModeLabel("—");
    setScanFeedbackLabel(null);
    setScanFeedbackVariant(null);
    setFlashOn(false);
    setIsTorchSupported(false);

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
      }
      zxingControlsRef.current = null;
    }

    if (scanningModeRef.current === "zxing" && zxingReaderRef.current) {
      // decodeFromVideoDevice is stopped via controls.stop() in the callback;
      // we only need to clear the reader reference here.
      zxingReaderRef.current = null;
    }

    scanningModeRef.current = null;
  }

  // Check if torch is supported and toggle it
  async function toggleTorch(enable: boolean) {
    const stream = streamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: enable } as MediaTrackConstraintSet],
      });
      setFlashOn(enable);
      setIsTorchSupported(true);
    } catch {
      // Torch control failed silently
      setIsTorchSupported(false);
    }
  }

  // Check torch support when stream is available
  function checkTorchSupport(stream: MediaStream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      setIsTorchSupported(false);
      return;
    }

    try {
      const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setIsTorchSupported(!!capabilities?.torch);
    } catch {
      setIsTorchSupported(false);
    }
  }

  async function startScanning() {
    if (isScanningRef.current) return;
    setCameraError(null);
    hasFallenBackToZxingRef.current = false;

    async function startZxingFromCurrentVideo() {
      const video = videoRef.current;
      if (!video) return;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const reader = new BrowserQRCodeReader();
      zxingReaderRef.current = reader;
      isScanningRef.current = true;
      scanningModeRef.current = "zxing";
      setScannerModeLabel("ZXing");

      await reader.decodeFromVideoElement(video, (result, err, controls) => {
        zxingControlsRef.current = controls;

        if (!isScanningRef.current) {
          controls.stop();
          return;
        }

        if (result) {
          const value = result.getText();
          const now = Date.now();
          const lastValue = lastScanValueRef.current;
          const lastTime = lastScanTimeRef.current;

          if (value && (value !== lastValue || now - lastTime > 1000)) {
            lastScanValueRef.current = value;
            lastScanTimeRef.current = now;
            void processScan(value);
          }
        }
      });
    }

    // Helper to get camera stream with fallback constraints for mobile compatibility
    async function getCameraStream(): Promise<MediaStream> {
      // Try back camera first with flexible constraint
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback: try any available camera
          return await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        }
      }
    }

    const BarcodeDetectorCtor = (typeof window !== "undefined"
      ? (window as any).BarcodeDetector
      : undefined) as
      | (new (options: { formats: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
        }) & {
          getSupportedFormats?: () => Promise<string[]> | string[];
        }
      | undefined;

    const nativeSupportedFormats = (() => {
      const maybe = BarcodeDetectorCtor?.getSupportedFormats?.();
      if (!maybe) return null;
      if (Array.isArray(maybe)) return maybe;
      return null;
    })();

    const canUseNativeDetector =
      !!BarcodeDetectorCtor &&
      (!nativeSupportedFormats || nativeSupportedFormats.includes("qr_code")) &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";

    if (canUseNativeDetector) {
      try {
        const stream = await getCameraStream();

        const video = videoRef.current;
        if (!video) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => undefined);
        checkTorchSupport(stream);

        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        isScanningRef.current = true;
        scanningModeRef.current = "native";
        setScannerModeLabel("Native");
        nativeUseCanvasRef.current = true;
        nativeDetectErrorCountRef.current = 0;

        if (typeof document !== "undefined" && !detectorCanvasRef.current) {
          detectorCanvasRef.current = document.createElement("canvas");
        }

        const scanLoop = async () => {
          if (!isScanningRef.current) return;

          if (video.readyState >= 2) {
            const nowPerf = typeof performance !== "undefined" ? performance.now() : Date.now();
            if (nowPerf - lastDetectTimeRef.current < 100) {
              animationFrameRef.current = requestAnimationFrame(scanLoop);
              return;
            }

            lastDetectTimeRef.current = nowPerf;

            try {
              let results: Array<{ rawValue: string }> = [];
              if (nativeUseCanvasRef.current) {
                const canvas = detectorCanvasRef.current;
                const ctx = canvas?.getContext("2d", { willReadFrequently: true });

                if (!canvas || !ctx) {
                  animationFrameRef.current = requestAnimationFrame(scanLoop);
                  return;
                }

                const w = video.videoWidth;
                const h = video.videoHeight;
                if (!w || !h) {
                  animationFrameRef.current = requestAnimationFrame(scanLoop);
                  return;
                }

                if (canvas.width !== w || canvas.height !== h) {
                  canvas.width = w;
                  canvas.height = h;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                results = await detector.detect(canvas);
              } else {
                results = await detector.detect(video as unknown as CanvasImageSource);
              }

              if (results && results.length > 0) {
                const value = results[0]?.rawValue ?? "";
                const now = Date.now();
                const lastValue = lastScanValueRef.current;
                const lastTime = lastScanTimeRef.current;

                if (value && (value !== lastValue || now - lastTime > 1000)) {
                  lastScanValueRef.current = value;
                  lastScanTimeRef.current = now;
                  void processScan(value);
                }
              }
            } catch {
              nativeDetectErrorCountRef.current += 1;
              if (nativeUseCanvasRef.current) {
                nativeUseCanvasRef.current = false;
              } else if (nativeDetectErrorCountRef.current >= 10 && !hasFallenBackToZxingRef.current) {
                hasFallenBackToZxingRef.current = true;
                try {
                  await startZxingFromCurrentVideo();
                } catch {
                  await stopScanning();
                }
                return;
              }
            }
          }

          animationFrameRef.current = requestAnimationFrame(scanLoop);
        };

        animationFrameRef.current = requestAnimationFrame(scanLoop);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Camera access failed";
        setCameraError(message);
        await stopScanning();
      }

      return;
    }

    // Fallback to zxing library for browsers without native BarcodeDetector
    try {
      const video = videoRef.current;
      if (!video) return;

      // For zxing, we need to get the stream ourselves for mobile compatibility
      const stream = await getCameraStream();
      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => undefined);
      checkTorchSupport(stream);

      const reader = new BrowserQRCodeReader();
      zxingReaderRef.current = reader;
      isScanningRef.current = true;
      scanningModeRef.current = "zxing";
      setScannerModeLabel("ZXing");

      // Use decodeFromVideoElement instead of decodeFromVideoDevice for better mobile support
      await reader.decodeFromVideoElement(video, (result, err, controls) => {
        zxingControlsRef.current = controls;
        if (!isScanningRef.current) {
          controls.stop();
          return;
        }

        if (result) {
          const value = result.getText();
          const now = Date.now();
          const lastValue = lastScanValueRef.current;
          const lastTime = lastScanTimeRef.current;

          if (value && (value !== lastValue || now - lastTime > 1000)) {
            lastScanValueRef.current = value;
            lastScanTimeRef.current = now;
            void processScan(value);
          }
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera access failed";
      setCameraError(message);
      await stopScanning();
    }
  }

  const headerTitle = eventRecord?.title ?? MOCK_EVENT.title;
  const headerVenue = eventRecord?.venue ?? MOCK_EVENT.venue;
  const remainingAllowed =
    allowedStudentCount > 0 ? Math.max(allowedStudentCount - scanStats.totalScanned, 0) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
      />
      <div className="absolute left-4 top-16 z-20 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur">
        Mode: {scannerModeLabel}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/80" />
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => router.push("/sems/scan")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 text-center px-4">
            <h1 className="text-sm font-semibold text-white truncate">
              {headerTitle}
            </h1>
            <p className="text-[11px] text-white/70">{headerVenue}</p>
          </div>

          <button
            type="button"
            disabled={!isTorchSupported && !flashOn}
            onClick={() => {
              void toggleTorch(!flashOn);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-colors",
              flashOn
                ? "bg-amber-400 text-amber-900"
                : isTorchSupported
                  ? "bg-[#1B4D3E]/90 text-emerald-50 hover:bg-[#16352A]"
                  : "bg-white/10 text-white/60"
            )}
          >
            {flashOn ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{flashOn ? "Flash on" : "Flash off"}</span>
          </button>
        </div>

        {/* Camera Viewfinder Area */}
        <div className="flex-1 relative flex items-center justify-center px-4">
          {/* Scan frame */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-2xl" />
            {/* Scanning line animation */}
            <div className="scan-line absolute inset-x-4 h-0.5 bg-emerald-400 opacity-90 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          </div>

          <div className="absolute bottom-8 left-0 right-0 px-8 text-center">
            <p className="text-sm text-white/80 font-medium">
              Point camera at student's QR code
              Point camera at student&apos;s QR code
            </p>
            <p className="text-xs text-white/50 mt-1">
              Position QR code within the frame
            </p>
            {isCameraSupported === false && (
              <p className="text-[10px] text-red-300 mt-1">
                Camera-based scanning is not supported in this browser. Please try a different
                device or browser that supports camera access.
              </p>
            )}
            {cameraError && (
              <p className="text-[10px] text-red-300 mt-1">
                Camera error: {cameraError}. Please allow camera access in your browser settings and refresh.
              </p>
            )}
          </div>
        </div>

        {/* Bottom Student Info Card - floating panel */}
        <div className="pointer-events-none px-4 pb-6">
          <div
            className={cn(
              "bg-white/95 backdrop-blur rounded-[32px] shadow-2xl border border-white/70 max-w-md mx-auto w-full pointer-events-auto",
              isScanFeedbackPulsing && "scan-feedback-pop",
              isScanFeedbackPulsing && scanFeedbackVariant === "success" && "scan-feedback-glow-success",
              isScanFeedbackPulsing && scanFeedbackVariant === "warning" && "scan-feedback-glow-warning",
              isScanFeedbackPulsing && scanFeedbackVariant === "info" && "scan-feedback-glow-info",
              isScanFeedbackPulsing && scanFeedbackVariant === "error" && "scan-feedback-glow-error"
            )}
          >
            {!isLoadingResources && !eventRecord ? (
              <div className="px-5 pt-4 pb-5">
                {/* Drag handle */}
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      Scanner resources missing
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      Download event data to enable scanning.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gray-500">Scanned</p>
                    <p className="text-xl font-bold text-gray-900 tabular-nums">{scanStats.totalScanned}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 pt-4 pb-5">
                {/* Drag handle */}
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-gray-500">Last scanned</p>
                      {scanFeedbackLabel && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            scanFeedbackVariant === "success" && "bg-emerald-100 text-emerald-800",
                            scanFeedbackVariant === "warning" && "bg-amber-100 text-amber-800",
                            scanFeedbackVariant === "info" && "bg-sky-100 text-sky-800",
                            scanFeedbackVariant === "error" && "bg-rose-100 text-rose-800"
                          )}
                        >
                          {scanFeedbackLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {lastScan?.name ?? "Waiting for scan..."}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gray-500">Scanned</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{scanStats.totalScanned}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .scan-line {
          top: 14%;
          animation: scan-line 1.6s ease-in-out infinite alternate;
        }

        .scan-feedback-pop {
          animation: scan-feedback-pop 180ms ease-out;
        }

        @keyframes scan-feedback-pop {
          0% {
            transform: scale(0.985);
          }
          100% {
            transform: scale(1);
          }
        }

        .scan-feedback-glow-success {
          animation: scan-feedback-glow-success 520ms ease-out;
        }
        .scan-feedback-glow-warning {
          animation: scan-feedback-glow-warning 520ms ease-out;
        }
        .scan-feedback-glow-info {
          animation: scan-feedback-glow-info 520ms ease-out;
        }
        .scan-feedback-glow-error {
          animation: scan-feedback-glow-error 520ms ease-out;
        }

        @keyframes scan-feedback-glow-success {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
          }
          100% {
            box-shadow: 0 0 0 16px rgba(16, 185, 129, 0);
          }
        }
        @keyframes scan-feedback-glow-warning {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55);
          }
          100% {
            box-shadow: 0 0 0 16px rgba(245, 158, 11, 0);
          }
        }
        @keyframes scan-feedback-glow-info {
          0% {
            box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.55);
          }
          100% {
            box-shadow: 0 0 0 16px rgba(14, 165, 233, 0);
          }
        }
        @keyframes scan-feedback-glow-error {
          0% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.55);
          }
          100% {
            box-shadow: 0 0 0 16px rgba(244, 63, 94, 0);
          }
        }

        @keyframes scan-line {
          0% {
            top: 14%;
            opacity: 1;
          }
          100% {
            top: 78%;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
