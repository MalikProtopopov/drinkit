"use client";
import { useEffect } from "react";

export function BottomSheet({
  open,
  onClose,
  children,
  height,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: string;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40 animate-fadeIn"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-[390px] bg-white rounded-t-3xl shadow-2xl animate-sheetUp"
        style={{ maxHeight: height ?? "85dvh", overflowY: "auto" }}
      >
        <div className="sticky top-0 bg-white pt-2 pb-1 z-10">
          <div className="sheet-handle" />
        </div>
        {children}
      </div>
    </div>
  );
}
