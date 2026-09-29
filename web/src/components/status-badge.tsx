export function StatusBadge({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return <span className={`text-[var(--muted)] ${className}`}>—</span>;

  if (status.trim().toLowerCase() === "active") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold text-emerald-600 ${className}`}
      >
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.65)]" />
        </span>
        {status}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-stone-300" aria-hidden />
      {status}
    </span>
  );
}
