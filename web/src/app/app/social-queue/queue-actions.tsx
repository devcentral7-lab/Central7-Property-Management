"use client";

import {
  useOptimistic,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  approveSocialQueueItem,
  publishSocialQueueItem,
  revertSocialQueueItem,
  setSocialQueuePlatform,
} from "@/app/app/social-queue/actions";

export type PlatformDates = Record<string, { at?: string; by?: string | null }>;

const PLATFORM_COLORS: Record<string, string> = {
  Ikman: "#15803d",
  Facebook: "#1877f2",
  Instagram: "#d62976",
  LPW: "#c2410c",
};

function formatWhen(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QueueItemCard({
  id,
  done,
  platforms,
  dates,
  children,
}: {
  id: string;
  done: boolean;
  platforms: string[];
  dates: PlatformDates;
  children: ReactNode;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticDates, applyTick] = useOptimistic(
    dates,
    (state: PlatformDates, tick: { platform: string; done: boolean }) => {
      const next = { ...state };
      if (tick.done) next[tick.platform] = { at: new Date().toISOString() };
      else delete next[tick.platform];
      return next;
    },
  );

  const missing = platforms.filter((p) => !optimisticDates[p]);
  const tickedCount = platforms.length - missing.length;
  const canFinish = !done && missing.length === 0;

  function toggle(platform: string) {
    if (done) return;
    const nextDone = !optimisticDates[platform];
    setError(null);
    startTransition(async () => {
      applyTick({ platform, done: nextDone });
      try {
        await setSocialQueuePlatform(id, platform, nextDone);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update platform");
      }
    });
  }

  function finish(kind: "done" | "reopen") {
    const fd = new FormData();
    fd.set("id", id);
    setError(null);
    startTransition(async () => {
      try {
        if (kind === "done") await publishSocialQueueItem(fd);
        else await revertSocialQueueItem(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update item");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {children}

        {platforms.length ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Platforms">
            {platforms.map((p) => {
              const tick = optimisticDates[p];
              const checked = Boolean(tick);
              const color = PLATFORM_COLORS[p] ?? "#57534e";
              const detail = checked
                ? `Posted${tick?.by ? ` by ${tick.by}` : ""}${tick?.at ? ` · ${formatWhen(tick.at)}` : ""}`
                : done
                  ? "Not posted"
                  : `Tick when posted on ${p}`;
              return (
                <button
                  key={p}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={done}
                  onClick={() => toggle(p)}
                  title={detail}
                  style={{ "--c": color } as CSSProperties}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-default ${
                    checked
                      ? "border-[var(--c)] bg-[var(--c)] text-white shadow-sm"
                      : "border-[var(--c)]/50 bg-white text-[var(--c)] hover:bg-[var(--c)]/5"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      checked ? "border-white bg-white text-[var(--c)]" : "border-[var(--c)]/60"
                    }`}
                  >
                    {checked ? (
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    ) : null}
                  </span>
                  {p}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">No platforms requested.</p>
        )}

        {error ? (
          <p className="mt-2 text-xs font-medium text-[var(--danger)]">{error}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:w-36 sm:items-end">
        {done ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("reopen")}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-60 sm:w-full"
          >
            {busy ? "Saving…" : "Reopen"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || !canFinish}
              onClick={() => finish("done")}
              title={canFinish ? "Mark as done" : `Tick ${missing.join(", ")} first`}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-deep)] disabled:cursor-not-allowed disabled:bg-[var(--brand)]/35 disabled:shadow-none sm:w-full"
            >
              {busy && canFinish ? "Saving…" : "Done"}
            </button>
            {platforms.length ? (
              <span className="text-center text-xs text-[var(--muted)] sm:text-right">
                {tickedCount} of {platforms.length} posted
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export type SocialQueueStatus = "pending" | "approved" | "published";

export function queueStatusLabel(status: SocialQueueStatus) {
  if (status === "pending") return "Pending approval";
  if (status === "approved") return "Pending publish";
  return "Published";
}

export function SocialQueueStatusBadge({ status }: { status: SocialQueueStatus }) {
  const styles =
    status === "pending"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : status === "approved"
        ? "bg-sky-50 text-sky-800 border-sky-200"
        : "bg-emerald-50 text-emerald-800 border-emerald-200";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}
    >
      {queueStatusLabel(status)}
    </span>
  );
}

/** Activity = approve only. SMQ = publish / revert publish. */
export function SocialQueueActions({
  id,
  status,
  mode,
}: {
  id: string;
  status: SocialQueueStatus;
  mode: "activity" | "smq";
}) {
  const [pending, startTransition] = useTransition();

  function run(action: "approve" | "publish" | "revert") {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      if (action === "approve") await approveSocialQueueItem(fd);
      else if (action === "publish") await publishSocialQueueItem(fd);
      else await revertSocialQueueItem(fd);
    });
  }

  if (mode === "activity") {
    if (status !== "pending") return null;
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Approve"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "approved" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("publish")}
          className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark published"}
        </button>
      ) : null}
      {status === "published" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("revert")}
          className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Revert to pending"}
        </button>
      ) : null}
    </div>
  );
}
