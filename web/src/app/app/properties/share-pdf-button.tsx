"use client";

import { useEffect, useRef, useState } from "react";

type Copy = "client" | "agent";

const OPTIONS: { copy: Copy; label: string; hint: string }[] = [
  { copy: "client", label: "Client copy", hint: "Central7 branded, with company contact details" },
  { copy: "agent", label: "Agent copy", hint: "No Central7 name, logo or contacts" },
];

function filenameFrom(header: string | null, fallback: string) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {}
  }
  return header?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens the phone's share sheet with the listing PDF attached. Phones only allow
 * `navigator.share` right after a tap, so if building the PDF took too long the
 * button turns into "Tap to share" with the file already in hand.
 */
export function SharePdfButton({ refNo, text }: { refNo: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Copy | null>(null);
  const [ready, setReady] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const files = useRef(new Map<Copy, File>());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  async function loadFile(copy: Copy): Promise<File> {
    const cached = files.current.get(copy);
    if (cached) return cached;
    const res = await fetch(`/api/properties/${encodeURIComponent(refNo)}/pdf?copy=${copy}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || `Could not create PDF (${res.status})`);
    }
    const blob = await res.blob();
    const file = new File(
      [blob],
      filenameFrom(res.headers.get("Content-Disposition"), `${refNo}.pdf`),
      { type: "application/pdf" },
    );
    files.current.set(copy, file);
    return file;
  }

  async function shareFile(file: File) {
    if (typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) {
      download(file);
      setReady(null);
      setMessage("This browser can't share files, so the PDF was downloaded instead.");
      return;
    }
    try {
      await navigator.share({ files: [file], title: file.name, ...(text ? { text } : {}) });
      setReady(null);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "AbortError") {
        setReady(null);
      } else if (name === "NotAllowedError") {
        setReady(file);
      } else {
        setReady(null);
        setMessage(e instanceof Error ? e.message : "Could not share the PDF");
      }
    }
  }

  async function pick(copy: Copy) {
    setOpen(false);
    setMessage(null);
    setReady(null);
    setBusy(copy);
    try {
      const file = await loadFile(copy);
      setBusy(null);
      await shareFile(file);
    } catch (e) {
      setBusy(null);
      setMessage(e instanceof Error ? e.message : "Could not create PDF");
    }
  }

  return (
    <div ref={ref} className="relative sm:hidden">
      {ready ? (
        <button
          type="button"
          onClick={() => void shareFile(ready)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
        >
          <ShareIcon />
          Tap to share PDF
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-busy={Boolean(busy)}
          disabled={Boolean(busy)}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-70"
        >
          {busy ? (
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : (
            <ShareIcon />
          )}
          {busy ? "Preparing…" : "Share"}
        </button>
      )}
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] p-1 shadow-lg"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.copy}
              type="button"
              role="menuitem"
              onClick={() => void pick(o.copy)}
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--bg-accent)]"
            >
              <span className="block text-sm font-semibold">Share {o.label.toLowerCase()}</span>
              <span className="block text-xs text-[var(--muted)]">{o.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
      {message ? (
        <p role="status" className="absolute right-0 top-full z-10 mt-1 w-64 text-right text-xs text-[var(--danger)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </svg>
  );
}
