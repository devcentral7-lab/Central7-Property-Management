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
  declineSocialQueueItem,
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
  return "Done";
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

/** Activity = pick platforms + approve. SMQ = publish / revert publish. */
export function SocialQueueActions({
  id,
  status,
  mode,
  platforms = [],
}: {
  id: string;
  status: SocialQueueStatus;
  mode: "activity" | "smq";
  /** Requested platforms; on approve, only the ones left selected are kept. */
  platforms?: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(platforms);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  function run(action: "approve" | "decline" | "publish" | "revert") {
    const fd = new FormData();
    fd.set("id", id);
    if (action === "approve") {
      for (const p of selected) fd.append("platforms", p);
    }
    if (action === "decline") fd.set("reason", reason);
    setError(null);
    startTransition(async () => {
      try {
        if (action === "approve") await approveSocialQueueItem(fd);
        else if (action === "decline") await declineSocialQueueItem(fd);
        else if (action === "publish") await publishSocialQueueItem(fd);
        else await revertSocialQueueItem(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update item");
      }
    });
  }

  function toggle(platform: string) {
    setSelected((cur) =>
      cur.includes(platform) ? cur.filter((p) => p !== platform) : [...cur, platform],
    );
  }

  if (mode === "activity") {
    if (status !== "pending") return null;
    const noneSelected = platforms.length > 0 && selected.length === 0;
    return (
      <div className="space-y-2">
        {platforms.length ? (
          <div role="group" aria-label="Platforms to approve">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Approve for
            </p>
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((p) => {
                const checked = selected.includes(p);
                const color = PLATFORM_COLORS[p] ?? "#57534e";
                return (
                  <button
                    key={p}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={pending}
                    onClick={() => toggle(p)}
                    title={checked ? `Approve for ${p}` : `Not approved for ${p}`}
                    style={{ "--c": color } as CSSProperties}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition disabled:opacity-60 ${
                      checked
                        ? "border-[var(--c)] bg-[var(--c)] text-white"
                        : "border-[var(--c)]/50 bg-white text-[var(--c)] hover:bg-[var(--c)]/5"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        checked ? "border-white bg-white text-[var(--c)]" : "border-[var(--c)]/60"
                      }`}
                    >
                      {checked ? (
                        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8.5 3 3 6-7" />
                        </svg>
                      ) : null}
                    </span>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {declining ? (
          <div className="space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              autoFocus
              disabled={pending}
              placeholder="Reason (optional)"
              className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run("decline")}
                className="rounded-full bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Declining…" : "Confirm decline"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDeclining(false);
                  setReason("");
                  setError(null);
                }}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || noneSelected}
              onClick={() => run("approve")}
              title={noneSelected ? "Select at least one platform" : undefined}
              className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? "Saving…"
                : platforms.length && selected.length < platforms.length
                  ? `Approve ${selected.length} of ${platforms.length}`
                  : "Approve"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeclining(true)}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--bg-accent)] disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        )}
        {error ? (
          <p className="text-xs font-medium text-[var(--danger)]">{error}</p>
        ) : null}
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
      {error ? (
        <p className="w-full text-xs font-medium text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
