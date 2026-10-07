"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DASHBOARD_PERIODS,
  DEFAULT_DASHBOARD_PERIOD,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

export function PeriodSelect({
  period,
  year,
  currentYear,
  firstYear,
}: {
  period: DashboardPeriod;
  year: number;
  currentYear: number;
  firstYear: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const years = Array.from({ length: Math.max(1, currentYear - firstYear + 1) }, (_, i) => currentYear - i);

  function hrefFor(next: { period?: DashboardPeriod; year?: number }) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("period");
    sp.delete("year");
    if (next.year) sp.set("year", String(next.year));
    else if (next.period && next.period !== DEFAULT_DASHBOARD_PERIOD) sp.set("period", next.period);
    const qs = sp.toString();
    return qs ? `/app?${qs}` : "/app";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Period"
        className="inline-flex rounded-full border border-[var(--line)] bg-[var(--card)] p-1"
      >
        {DASHBOARD_PERIODS.map((p) => {
          const active = p.id === period && (p.id !== "year" || year === currentYear);
          return (
            <Link
              key={p.id}
              href={hrefFor({ period: p.id })}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:text-sm ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
      <label className="relative">
        <span className="sr-only">Year</span>
        <select
          value={period === "year" ? String(year) : ""}
          onChange={(e) => {
            const y = Number(e.target.value);
            router.push(y ? hrefFor({ year: y }) : hrefFor({ period: DEFAULT_DASHBOARD_PERIOD }));
          }}
          className={`appearance-none rounded-full border py-2 pl-4 pr-9 text-xs font-semibold outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 sm:py-2.5 sm:text-sm ${
            period === "year" && year !== currentYear
              ? "border-transparent bg-[var(--ink)] text-white"
              : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
          }`}
        >
          <option value="" className="bg-white text-[var(--ink)]">Year</option>
          {years.map((y) => (
            <option key={y} value={y} className="bg-white text-[var(--ink)]">
              {y}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
            period === "year" && year !== currentYear ? "text-white" : "text-[var(--muted)]"
          }`}
          aria-hidden
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </label>
    </div>
  );
}
