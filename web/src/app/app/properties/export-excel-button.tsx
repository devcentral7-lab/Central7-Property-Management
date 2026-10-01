"use client";

import { useState } from "react";

type Props = {
  /** Query string for `/api/properties/export` (`user` is ignored for non-admins). */
  query?: string;
  /** Whether `query` narrows the export with list filters. */
  filtered?: boolean;
  disabled?: boolean;
};

function filenameFrom(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "central7-listings.xlsx";
}

export function ExportExcelButton({ query = "", filtered = false, disabled = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const qs = query ? `?${query}` : "";
      const res = await fetch(`/api/properties/export${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(res.headers.get("Content-Disposition"));
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <button
        type="button"
        onClick={download}
        disabled={disabled || busy}
        aria-busy={busy}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1d6f42]/30 bg-[#1d6f42]/5 px-4 py-2 text-sm font-semibold text-[#1d6f42] transition hover:bg-[#1d6f42]/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="m9.5 12.5 5 5" />
            <path d="m14.5 12.5-5 5" />
          </svg>
        )}
        {busy ? "Preparing Excel…" : filtered ? "Export filtered to Excel" : "Export to Excel"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
