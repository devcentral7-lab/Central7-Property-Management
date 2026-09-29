"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SIZES = {
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
} as const;

/** Centred dialog (bottom sheet on mobile) that can stack above the property modal. */
export function PopupDialog({
  open,
  onClose,
  title,
  subtitle,
  busy,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  busy?: boolean;
  size?: keyof typeof SIZES;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Capture phase + stop so the parent property modal stays open.
      e.stopImmediatePropagation();
      e.stopPropagation();
      if (!busy) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-[var(--line)] bg-[var(--card)] shadow-2xl sm:rounded-2xl ${SIZES[size]}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--bg-accent)] disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
