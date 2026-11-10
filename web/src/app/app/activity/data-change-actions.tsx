"use client";

import { useState, useTransition } from "react";
import { resolveDataChange } from "@/app/app/activity/actions";
import {
  SocialQueueStatusBadge,
  type SocialQueueStatus,
} from "@/app/app/social-queue/queue-actions";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DataChangeActions({
  id,
  resolvedAt,
  resolvedBy,
  note,
  queueStatus,
}: {
  id: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** Whether it went to the social media queue, and why not if it didn't. */
  note: string | null;
  /** Status of the social media queue item this request created or approved, if any. */
  queueStatus: SocialQueueStatus | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [platformChoices, setPlatformChoices] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  function markDone(platforms?: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await resolveDataChange(id, platforms);
        if (!result.ok) setError(result.error);
        else if (result.data.needsPlatforms) setPlatformChoices(result.data.platforms);
        else setMessage(result.data.message);
      } catch {
        setError("Could not update request");
      }
    });
  }

  if (resolvedAt) {
    const detail = note || message;
    return (
      <div className="max-w-72 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            Done
          </span>
          {queueStatus ? <SocialQueueStatusBadge status={queueStatus} /> : null}
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          {resolvedBy ? `${resolvedBy} · ` : ""}
          {formatWhen(resolvedAt)}
        </p>
        {detail ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-[var(--muted)]" title={detail}>
            {detail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        To do
      </span>
      {platformChoices ? (
        <fieldset className="max-w-72 space-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg-accent)]/40 p-2.5">
          <legend className="px-1 text-[11px] font-semibold text-[var(--ink)]">
            Where is this listing posted?
          </legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {platformChoices.map((p) => (
              <label key={p} className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={picked.includes(p)}
                  onChange={(e) =>
                    setPicked((prev) =>
                      e.target.checked ? [...prev, p] : prev.filter((x) => x !== p),
                    )
                  }
                />
                {p}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending || !picked.length}
              onClick={() => markDone(picked)}
              className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Send to queue"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => markDone([])}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--bg-accent)] disabled:opacity-60"
            >
              Not on social
            </button>
          </div>
        </fieldset>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => markDone()}
          title="Mark done after updating the listing. If it's posted on social media, it goes to the social media queue."
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark as done"}
        </button>
      )}
      {error ? <p className="text-xs font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
