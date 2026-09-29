"use client";

import { useState } from "react";
import { PopupDialog } from "@/components/popup-dialog";

export type ActivityEvent = {
  id: string;
  action: string;
  actor_name: string | null;
  assigned_to: string | null;
  comment: string | null;
  occurred_at: string | null;
};

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

function formatWhen(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : WHEN.format(d);
}

export function ActivityButton({ refNo, events }: { refNo: string; events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Activity
        {events.length ? (
          <span className="rounded-full bg-[var(--bg-accent)] px-1.5 text-xs font-semibold text-[var(--muted)]">
            {events.length}
          </span>
        ) : null}
      </button>

      <PopupDialog open={open} onClose={() => setOpen(false)} title="Recent activity" subtitle={refNo}>
        {events.length ? (
          <ol className="relative space-y-4 border-l border-[var(--line)] pl-5">
            {events.map((e, i) => {
              const when = formatWhen(e.occurred_at);
              return (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--card)] ${
                      i === 0 ? "bg-[var(--brand)]" : "bg-stone-300"
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-semibold">{e.action}</p>
                    {when ? <p className="text-xs text-[var(--muted)]">{when}</p> : null}
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {e.actor_name || "—"}
                    {e.assigned_to ? ` → ${e.assigned_to}` : ""}
                  </p>
                  {e.comment ? (
                    <p className="mt-1.5 rounded-lg bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]">
                      {e.comment}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No activity yet.</p>
        )}
      </PopupDialog>
    </>
  );
}
