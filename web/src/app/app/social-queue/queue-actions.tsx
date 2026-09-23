"use client";

import { useTransition } from "react";
import {
  approveSocialQueueItem,
  publishSocialQueueItem,
  revertSocialQueueItem,
} from "@/app/app/social-queue/actions";

export type SocialQueueStatus = "pending" | "approved" | "published";

export function queueStatusLabel(status: SocialQueueStatus) {
  if (status === "pending") return "Pending approval";
  if (status === "approved") return "Approved";
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

export function SocialQueueActions({
  id,
  status,
}: {
  id: string;
  status: SocialQueueStatus;
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

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark approved"}
        </button>
      ) : null}
      {status === "approved" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("publish")}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Mark published"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("revert")}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:underline disabled:opacity-60"
          >
            Revert to pending
          </button>
        </>
      ) : null}
      {status === "published" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("revert")}
          className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Revert to approved"}
        </button>
      ) : null}
    </div>
  );
}
