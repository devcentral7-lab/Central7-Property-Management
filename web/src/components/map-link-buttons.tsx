"use client";

import { useEffect, useRef, useState } from "react";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30";
const openClass = `${buttonBase} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-deep)]`;
const copyClass = `${buttonBase} border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--bg-accent)]`;

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  el.remove();
  if (!ok) throw new Error("Copy failed");
}

/** "Open in Google Maps" and "Copy link" for a listing's map URL. */
export function MapLinkButtons({ url }: { url: string }) {
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await copyText(url);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-nav-skip
        className={openClass}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
          <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        Open in Google Maps
      </a>
      <button type="button" onClick={copy} className={copyClass} aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
          {copied === "ok" ? (
            <path d="m5 12 4.5 4.5L19 7" />
          ) : (
            <>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
            </>
          )}
        </svg>
        {copied === "ok" ? "Copied!" : copied === "failed" ? "Couldn't copy" : "Copy link"}
      </button>
    </div>
  );
}
