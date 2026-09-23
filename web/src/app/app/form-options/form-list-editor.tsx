"use client";

import { useState, useTransition } from "react";
import { saveFormList } from "./actions";
import type { FormListKey } from "@/lib/form-options";

type Props = {
  listKey: FormListKey;
  title: string;
  description: string;
  initialItems: string[];
};

export function FormListEditor({
  listKey,
  title,
  description,
  initialItems,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function addItem() {
    const t = draft.trim();
    if (!t) return;
    if (items.some((i) => i.toLowerCase() === t.toLowerCase())) {
      setError(true);
      setMessage("That option already exists.");
      return;
    }
    setItems((prev) => [...prev, t]);
    setDraft("");
    setMessage(null);
    setError(false);
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function save() {
    setMessage(null);
    setError(false);
    startTransition(async () => {
      try {
        await saveFormList(listKey, items);
        setMessage("Saved.");
      } catch (e) {
        setError(true);
        setMessage(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save list"}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-sm">{item}</span>
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs disabled:opacity-40"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
              className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs disabled:opacity-40"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs text-[var(--danger)]"
            >
              Remove
            </button>
          </li>
        ))}
        {!items.length ? (
          <li className="text-sm text-[var(--muted)]">No options yet.</li>
        ) : null}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Add option…"
          className="min-w-[12rem] flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addItem}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-accent)]"
        >
          Add
        </button>
      </div>

      {message ? (
        <p
          className={`mt-3 text-sm ${
            error ? "text-[var(--danger)]" : "text-[var(--muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
