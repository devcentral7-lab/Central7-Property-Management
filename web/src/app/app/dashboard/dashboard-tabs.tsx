"use client";

import { useState, type ReactNode } from "react";

export type DashboardView = "stats" | "visuals";

const TABS: { id: DashboardView; label: string }[] = [
  { id: "stats", label: "Statistics" },
  { id: "visuals", label: "Visuals" },
];

export function DashboardTabs({
  initialView,
  stats,
  visuals,
}: {
  initialView: DashboardView;
  stats: ReactNode;
  visuals: ReactNode;
}) {
  const [view, setView] = useState<DashboardView>(initialView);

  function select(next: DashboardView) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "stats") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Dashboard views"
        className="tab-scroll -mx-4 border-b border-[var(--line)] px-4 pb-3 sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => {
          const active = t.id === view;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`dashboard-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`dashboard-panel-${t.id}`}
              onClick={() => select(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`dashboard-panel-${t.id}`}
          aria-labelledby={`dashboard-tab-${t.id}`}
          hidden={t.id !== view}
          className="mt-5 sm:mt-6"
        >
          {t.id === "stats" ? stats : visuals}
        </div>
      ))}
    </div>
  );
}
