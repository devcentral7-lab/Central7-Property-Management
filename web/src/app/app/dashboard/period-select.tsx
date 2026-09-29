"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

export function PeriodSelect({ period }: { period: DashboardPeriod }) {
  const params = useSearchParams();

  function hrefFor(next: DashboardPeriod) {
    const sp = new URLSearchParams(params.toString());
    if (next === "30d") sp.delete("period");
    else sp.set("period", next);
    const qs = sp.toString();
    return qs ? `/app?${qs}` : "/app";
  }

  return (
    <div
      role="group"
      aria-label="Period"
      className="inline-flex rounded-full border border-[var(--line)] bg-[var(--card)] p-1"
    >
      {DASHBOARD_PERIODS.map((p) => {
        const active = p.id === period;
        return (
          <Link
            key={p.id}
            href={hrefFor(p.id)}
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
  );
}
