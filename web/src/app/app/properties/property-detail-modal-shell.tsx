"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, type ReactNode } from "react";

export function PropertyModalShell({
  children,
  title = "Property",
  wide = false,
}: {
  children: ReactNode;
  title?: string;
  wide?: boolean;
}) {
  const router = useRouter();

  const close = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/app/properties");
    }
  }, [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 my-4 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-2xl ${
          wide ? "max-w-6xl" : "max-w-5xl"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-[var(--muted)]">{title}</p>
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-accent)]"
          >
            Close
          </button>
        </div>
        <div className="max-h-[min(85vh,900px)] overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** @deprecated use PropertyModalShell */
export function PropertyDetailModalShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <PropertyModalShell title={title || "Property details"}>
      {children}
    </PropertyModalShell>
  );
}
