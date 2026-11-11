"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueIkmanBatch,
  previewIkmanPaste,
} from "@/app/app/ikman-republish/actions";
import {
  canForceInclude,
  dispositionLabel,
  extractIkmanRefNos,
  type IkmanDisposition,
  type IkmanPreviewRow,
} from "@/lib/ikman-republish";

function dispositionTone(d: IkmanDisposition) {
  switch (d) {
    case "new":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "pending_owner":
    case "pending_admin":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "suppressed":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "recently_done":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-[var(--line)] bg-[var(--bg-accent)] text-[var(--muted)]";
  }
}

export function IkmanImportForm() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<IkmanPreviewRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of preview ?? []) c[row.disposition] = (c[row.disposition] ?? 0) + 1;
    return c;
  }, [preview]);

  function runPreview() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await previewIkmanPaste(raw);
      if (!res.ok) {
        setError(res.error);
        setPreview(null);
        return;
      }
      setPreview(res.data);
      setSelected(new Set(res.data.filter((r) => r.defaultInclude).map((r) => r.ref_no)));
      if (!res.data.length) setError("No C7 reference numbers found in the pasted text.");
    });
  }

  function toggle(ref: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(ref);
      else next.delete(ref);
      return next;
    });
  }

  function selectDefaults() {
    if (!preview) return;
    setSelected(new Set(preview.filter((r) => r.defaultInclude).map((r) => r.ref_no)));
  }

  function selectIncludable() {
    if (!preview) return;
    setSelected(new Set(preview.filter((r) => canForceInclude(r.disposition)).map((r) => r.ref_no)));
  }

  function confirm() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await enqueueIkmanBatch({
        rawText: raw,
        includeRefs: [...selected],
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`Sent ${res.data.enqueued} to owners (${res.data.skipped} skipped).`);
      setPreview(null);
      setSelected(new Set());
      setRaw("");
      router.refresh();
    });
  }

  const parsedHint = extractIkmanRefNos(raw).length;

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Paste expired Ikman.lk listings
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setPreview(null);
            setMessage(null);
          }}
          rows={10}
          placeholder="Paste the full page text from Ikman expired posts. Reference numbers like C7-12345 will be extracted automatically."
          className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 font-mono text-xs leading-relaxed"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !raw.trim()}
          onClick={runPreview}
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending && !preview ? "Parsing…" : "Parse & preview"}
        </button>
        <span className="text-xs text-[var(--muted)]">
          {parsedHint ? `${parsedHint} unique ref${parsedHint === 1 ? "" : "s"} detected` : "No refs detected yet"}
        </span>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      ) : null}

      {preview?.length ? (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(counts).map(([k, n]) => (
                <span
                  key={k}
                  className={`rounded-full border px-2 py-0.5 font-semibold ${dispositionTone(k as IkmanDisposition)}`}
                >
                  {dispositionLabel(k as IkmanDisposition)}: {n}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectDefaults}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)]"
              >
                Defaults
              </button>
              <button
                type="button"
                onClick={selectIncludable}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)]"
              >
                New + forceable
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
                <tr>
                  <th className="px-3 py-2 font-bold">Send</th>
                  <th className="px-3 py-2 font-bold">Ref No</th>
                  <th className="px-3 py-2 font-bold">Disposition</th>
                  <th className="px-3 py-2 font-bold">Owner</th>
                  <th className="px-3 py-2 font-bold">Listing</th>
                  <th className="px-3 py-2 font-bold">Note</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const canInclude = canForceInclude(row.disposition);
                  return (
                    <tr key={row.ref_no} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!canInclude}
                          checked={selected.has(row.ref_no)}
                          onChange={(e) => toggle(row.ref_no, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-[var(--brand-deep)]">{row.ref_no}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dispositionTone(row.disposition)}`}
                        >
                          {dispositionLabel(row.disposition)}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.owner_name || "—"}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">
                        {[row.property_type, row.opportunity_type, row.city, row.property_status]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{row.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || selected.size === 0}
              onClick={confirm}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
            >
              {pending ? "Sending…" : `Send ${selected.size} to owners`}
            </button>
            <p className="text-xs text-[var(--muted)]">
              Tick suppressed or already-republished rows to force re-ask. Already-pending rows stay skipped.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
