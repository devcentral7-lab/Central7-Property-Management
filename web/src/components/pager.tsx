import Link from "next/link";

type Props = {
  page: number;
  /** Omit when the total is unknown; `hasNext` then decides whether "Next" is enabled. */
  totalPages?: number;
  hasNext?: boolean;
  className?: string;
} & (
  | { hrefFor: (page: number) => string; onPage?: never }
  | { onPage: (page: number) => void; hrefFor?: never }
);

const step = "rounded-lg px-2 py-2 text-sm font-medium transition hover:bg-[var(--bg-accent)]";
const off = "pointer-events-none opacity-40";

/** Previous / Next controls for lists shown PAGE_SIZE rows at a time. */
export function Pager({ page, totalPages, hasNext, className = "", hrefFor, onPage }: Props) {
  const canPrev = page > 1;
  const canNext = totalPages === undefined ? Boolean(hasNext) : page < totalPages;
  if (!canPrev && !canNext) return null;

  const control = (target: number, enabled: boolean, label: string, edge: string) =>
    hrefFor ? (
      <Link
        href={hrefFor(target)}
        aria-disabled={!enabled}
        tabIndex={enabled ? undefined : -1}
        className={`${edge} ${step} ${enabled ? "" : off}`}
      >
        {label}
      </Link>
    ) : (
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onPage?.(target)}
        className={`${edge} ${step} disabled:pointer-events-none disabled:opacity-40`}
      >
        {label}
      </button>
    );

  return (
    <nav aria-label="Pages" className={`flex items-center justify-between gap-3 ${className}`}>
      {control(page - 1, canPrev, "← Previous", "-ml-2")}
      <span className="text-xs tabular-nums text-[var(--muted)]">
        Page {page}
        {totalPages === undefined ? "" : ` of ${totalPages}`}
      </span>
      {control(page + 1, canNext, "Next →", "-mr-2")}
    </nav>
  );
}

export function pageFromParam(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 1 ? Math.min(n, 10_000) : 1;
}
