"use client";

import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  {
    copy: "client",
    label: "Client copy",
    hint: "Central7 branded, with company contact details",
  },
  {
    copy: "agent",
    label: "Agent copy",
    hint: "Property details and ref no. only, no Central7 name, logo or contacts",
  },
] as const;

const MENU_WIDTH = 256;
const EDGE_GAP = 8;

export function ExportPdfButton({ refNo }: { refNo: string }) {
  const [open, setOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && ref.current) {
      // Open toward whichever side has room so the menu stays on screen.
      const rect = ref.current.getBoundingClientRect();
      setAlignLeft(rect.right - MENU_WIDTH < EDGE_GAP);
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
          <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export PDF
      </button>
      {open ? (
        <div
          role="menu"
          style={{ width: MENU_WIDTH }}
          className={`absolute z-20 mt-2 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] p-1 shadow-lg ${
            alignLeft ? "left-0" : "right-0"
          }`}
        >
          {OPTIONS.map((o) => (
            <a
              key={o.copy}
              role="menuitem"
              href={`/api/properties/${encodeURIComponent(refNo)}/pdf?copy=${o.copy}`}
              download
              data-nav-skip
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 hover:bg-[var(--bg-accent)]"
            >
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-[var(--muted)]">{o.hint}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
