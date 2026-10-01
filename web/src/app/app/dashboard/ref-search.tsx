"use client";

import { useEffect, useRef, useState } from "react";
import { usePropertyModal } from "@/app/app/properties/property-modal";
import { searchRefNumbers, type RefMatch } from "@/app/app/properties/search-actions";
import { Icon } from "@/app/app/user-management/ui";
import { StatusBadge } from "@/components/status-badge";

export function RefSearch() {
  const { openView } = usePropertyModal();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<RefMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const q = term.trim();

  useEffect(() => {
    if (!q) return;
    const id = ++seq.current;
    const timer = setTimeout(() => {
      searchRefNumbers(q).then(
        (rows) => {
          if (id !== seq.current) return;
          setResults(rows);
          setError(null);
          setLoading(false);
        },
        () => {
          if (id !== seq.current) return;
          setResults([]);
          setError("Search failed. Try again.");
          setLoading(false);
        },
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function choose(refNo: string) {
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
    openView(refNo);
  }

  function onChange(value: string) {
    setTerm(value);
    setOpen(true);
    if (value.trim()) {
      setLoading(true);
    } else {
      seq.current++;
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }

  const showPanel = open && q.length > 0;

  return (
    <div ref={boxRef} className="relative sm:hidden">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (results[0]) choose(results[0].ref_no);
        }}
      >
        <label className="relative block">
          <span className="sr-only">Search by reference number</span>
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[var(--muted)]">
            <Icon name="search" className="h-[18px] w-[18px]" />
          </span>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={term}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search reference no. e.g. C7-10683"
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--card)] py-3 pl-11 pr-4 text-base shadow-[0_1px_2px_rgba(28,25,23,0.04)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
          />
        </label>
      </form>

      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-lg">
          {results.length ? (
            <ul className="max-h-80 divide-y divide-[var(--line)] overflow-y-auto">
              {results.map((r) => (
                <li key={r.ref_no}>
                  <button
                    type="button"
                    onClick={() => choose(r.ref_no)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-[var(--bg-accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-[var(--brand-deep)]">{r.ref_no}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {[
                          r.property_type,
                          r.opportunity_type === "Rent Out" ? "For rent" : r.opportunity_type ? "For sale" : null,
                          r.city,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                    {r.status ? <StatusBadge status={r.status} className="shrink-0 text-xs" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-center text-sm text-[var(--muted)]">
              {loading ? "Searching…" : error ?? `No property matches “${q}”.`}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
