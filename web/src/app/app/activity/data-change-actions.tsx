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
  /** Status of the "Data Change" social media queue item, if one was created. */
  queueStatus: SocialQueueStatus | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function markDone() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await resolveDataChange(id);
        setMessage(result.message);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update request");
      }
    });
  }

  if (resolvedAt) {
    const detail = note || message;
    return (
      <div className="space-y-1.5">
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          Done
        </span>
        <p className="text-xs text-[var(--muted)]">
          {resolvedBy ? `by ${resolvedBy} · ` : ""}
          {formatWhen(resolvedAt)}
        </p>
        {queueStatus ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
            Social media: <SocialQueueStatusBadge status={queueStatus} />
          </div>
        ) : null}
        {detail ? <p className="max-w-64 text-xs text-[var(--muted)]">{detail}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        To do
      </span>
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={markDone}
          title="Mark done after updating the listing. If it's posted on social media, it goes to the social media queue."
          className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark as done"}
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
