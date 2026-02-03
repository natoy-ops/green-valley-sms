"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SponsorModal({ isOpen, onClose }: SponsorModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/80 border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-200 shadow-sm hover:shadow-md"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-8">
          <div className="relative w-full aspect-[16/10] md:aspect-[16/9] rounded-xl overflow-hidden border border-border shadow-md">
            <Image
              src="/sponsor.jpg"
              alt="Sponsor"
              fill
              className="object-contain bg-background"
              priority
            />
          </div>

          <div className="mt-6 text-center space-y-1.5 border-t border-border pt-4">
            <p className="text-sm font-medium text-muted-foreground">
              @ 2025 GREEN VALLEY v1.0.0
            </p>
            <p className="text-xs text-muted-foreground">
              Initiated by <span className="font-semibold text-primary">SSC</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
