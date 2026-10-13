"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MONTH_NAMES, monthRangeFor, type PerformancePeriod } from "@/lib/finance-shared";

const field =
  "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15";
const label = "block text-xs font-semibold text-[var(--muted)]";

type Values = { from: string; to: string; month: string; year: string };

/** Typing a year fires changes like 0002-10-01, so only real dates are applied. */
const isUsableDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000;

function valuesOf(period: PerformancePeriod): Values {
  return { from: period.from, to: period.to, month: period.month, year: String(period.year) };
}

export function PerformanceFilters({
  period,
  years,
  paramPrefix = "",
}: {
  period: PerformancePeriod;
  years: number[];
  /** Prefix for the URL params, so they don't clash with other filters on the page. */
  paramPrefix?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(() => valuesOf(period));
  const [synced, setSynced] = useState(period);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (synced !== period) {
    setSynced(period);
    setValues(valuesOf(period));
  }

  useEffect(() => () => {
    if (dateTimer.current) clearTimeout(dateTimer.current);
  }, []);

  function apply(next: Values) {
    const query = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) query.set(`${paramPrefix}${key}`, value);
    startTransition(() => router.replace(`/app?${query}`, { scroll: false }));
  }

  function pick(year: string, month: string) {
    if (dateTimer.current) clearTimeout(dateTimer.current);
    const next = { year, month, ...monthRangeFor(Number(year), month) };
    setValues(next);
    apply(next);
  }

  function changeDate(key: "from" | "to", value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (dateTimer.current) clearTimeout(dateTimer.current);
    if (!isUsableDate(next.from) || !isUsableDate(next.to)) return;
    dateTimer.current = setTimeout(() => apply(next), 450);
  }

  return (
    <div className="relative" aria-busy={pending}>
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <label className="min-w-0">
          <span className={label}>From</span>
          <input type="date" value={values.from} onChange={(e) => changeDate("from", e.target.value)} className={field} />
        </label>
        <label className="min-w-0">
          <span className={label}>To</span>
          <input type="date" value={values.to} onChange={(e) => changeDate("to", e.target.value)} className={field} />
        </label>
        <label className="min-w-0">
          <span className={label}>Month</span>
          <select value={values.month} onChange={(e) => pick(values.year, e.target.value)} className={field}>
            <option value="">All months</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className={label}>Year</span>
          <select value={values.year} onChange={(e) => pick(e.target.value, values.month)} className={field}>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 -bottom-2.5 h-0.5 overflow-hidden rounded-full bg-[var(--brand)]/15 transition-opacity duration-200 ${
          pending ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="block h-full w-1/3 animate-[filter-progress_1s_ease-in-out_infinite] rounded-full bg-[var(--brand)] motion-reduce:animate-none" />
      </span>
    </div>
  );
}
