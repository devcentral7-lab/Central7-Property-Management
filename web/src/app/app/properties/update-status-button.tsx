"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updatePropertyStatus } from "@/app/app/actions";
import { PopupDialog } from "@/components/popup-dialog";

export function UpdateStatusButton({
  refNo,
  options,
  platforms,
  defaultPlatforms = [],
  onDone,
}: {
  refNo: string;
  options: string[];
  /** Social media platforms offered when republishing. */
  platforms: string[];
  /** Platforms last requested for this listing; pre-ticked on Republish. */
  defaultPlatforms?: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState("Data Change");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const selectRef = useRef<HTMLSelectElement>(null);
  const commentRequired = action === "Data Change";
  const isRepublish = action === "Republish";
  const missingPlatforms = isRepublish && selectedPlatforms.length === 0;

  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updatePropertyStatus(fd);
        setOpen(false);
        router.refresh();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update status.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAction("Data Change");
          setSelectedPlatforms(defaultPlatforms.filter((p) => platforms.includes(p)));
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 10a6 6 0 0 1 10.2-4.3L16 7.5M16 4v3.5h-3.5M16 10a6 6 0 0 1-10.2 4.3L4 12.5M4 16v-3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Update status
      </button>

      <PopupDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Update Status"
        subtitle={refNo}
        busy={pending}
      >
        <form onSubmit={onSubmit}>
          <input type="hidden" name="ref_no" value={refNo} />
          <label className="block text-sm font-medium">
            Action
            <select
              ref={selectRef}
              name="action"
              required
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-sm"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          {isRepublish ? (
            <fieldset className="mt-3">
              <legend className="text-sm font-medium">
                Social media platforms{" "}
                <span className="text-[var(--brand)]" aria-hidden>
                  *
                </span>
              </legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {platforms.map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm transition hover:border-stone-300 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5"
                  >
                    <input
                      type="checkbox"
                      name="platforms"
                      value={p}
                      checked={selectedPlatforms.includes(p)}
                      onChange={(e) =>
                        setSelectedPlatforms((cur) =>
                          e.target.checked ? [...cur, p] : cur.filter((x) => x !== p),
                        )
                      }
                      className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                    />
                    {p}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                An admin approves this before it goes to the social media queue.
              </p>
            </fieldset>
          ) : null}
          <label className="mt-3 block text-sm font-medium">
            Comment{" "}
            {commentRequired ? (
              <span className="text-[var(--brand)]" aria-hidden>
                *
              </span>
            ) : (
              <span className="font-normal text-[var(--muted)]">(optional)</span>
            )}
            <textarea
              name="comment"
              rows={3}
              required={commentRequired}
              placeholder={
                commentRequired
                  ? "What needs to change? e.g. Price reduced to LKR 42M"
                  : "What changed and why?"
              }
              className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            />
          </label>

          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="flex-1 rounded-full border border-[var(--line)] py-2.5 text-sm font-semibold hover:bg-[var(--bg-accent)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || missingPlatforms}
              title={missingPlatforms ? "Select at least one platform" : undefined}
              className="flex-1 rounded-full bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? "Saving…" : "Submit"}
            </button>
          </div>
        </form>
      </PopupDialog>
    </>
  );
}
