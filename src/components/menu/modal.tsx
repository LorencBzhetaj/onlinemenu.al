"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Mbyll me Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-midnight-soft border border-alpine-cream/15 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-alpine-cream/10 px-5 py-4">
          <h2 className="font-heading text-xl text-alpine-cream">{title}</h2>
          <button
            onClick={onClose}
            className="text-alpine-cream/50 hover:text-alpine-cream text-2xl leading-none"
            aria-label="Mbyll"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-alpine-cream/70 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-alpine-cream/40 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg bg-midnight border border-alpine-cream/20 px-3 py-2 text-alpine-cream outline-none focus:border-alpine-gold";
