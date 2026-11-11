"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decideIkmanItem,
  forceReaskIkmanItem,
  markIkmanRepublished,
} from "@/app/app/ikman-republish/actions";

export function OwnerDecideButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function decide(decision: "approve" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = await decideIkmanItem(id, decision, note);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2" data-row-ignore>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note"
        className="w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs"
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("approve")}
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Republish on Ikman"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("decline")}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--bg-accent)] disabled:opacity-60"
        >
          Do not republish
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export function MarkRepublishedButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div data-row-ignore>
      <button
        type="button"
        disabled={pending || ids.length === 0}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await markIkmanRepublished(ids);
            if (!res.ok) setError(res.error);
            else router.refresh();
          });
        }}
        className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
      >
        {pending ? "Saving…" : ids.length > 1 ? `Mark ${ids.length} republished` : "Mark republished"}
      </button>
      {error ? <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export function ReadyQueueActions({ items }: { items: { id: string; ref_no: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.id)));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelected(new Set(items.map((i) => i.id)))}
          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[var(--bg-accent)]"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[var(--bg-accent)]"
        >
          Clear
        </button>
        <MarkRepublishedButton ids={[...selected]} />
      </div>
      <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={(e) => toggle(item.id, e.target.checked)}
            />
            <span className="font-semibold text-[var(--brand-deep)]">{item.ref_no}</span>
            <div className="ml-auto">
              <MarkRepublishedButton ids={[item.id]} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ForceReaskButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div data-row-ignore>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await forceReaskIkmanItem(id);
            if (!res.ok) setError(res.error);
            else router.refresh();
          });
        }}
        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Force re-ask"}
      </button>
      {error ? <p className="mt-1 text-xs font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
