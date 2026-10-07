import Link from "next/link";

export function ErrorPanel({
  title,
  message,
  digest,
  onRetry,
  homeHref,
  homeLabel = "Go to dashboard",
}: {
  title: string;
  message: string;
  /** Server error id, so a report can be matched to the server logs. */
  digest?: string;
  onRetry?: () => void;
  homeHref: string;
  homeLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[var(--danger)]"
      >
        <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10 6.5v4.5M10 13.5v.01M8.6 3.3 2.4 14a1.6 1.6 0 0 0 1.4 2.4h12.4a1.6 1.6 0 0 0 1.4-2.4L11.4 3.3a1.6 1.6 0 0 0-2.8 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      {digest ? <p className="mt-2 text-xs text-[var(--muted)]">Reference: {digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
          >
            Try again
          </button>
        ) : null}
        <Link
          href={homeHref}
          className="rounded-full border border-[var(--line)] px-5 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
