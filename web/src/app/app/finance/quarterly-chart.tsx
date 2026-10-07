import { formatLkr } from "@/lib/finance-shared";

function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

/** Grouped columns: one group per quarter, one bar per agent. */
export function QuarterlyChart({
  agents,
  colors,
  values,
}: {
  agents: string[];
  colors: string[];
  /** values[agent][quarter 1-4] */
  values: Record<string, Record<number, number>>;
}) {
  const max = Math.max(1, ...agents.flatMap((a) => [1, 2, 3, 4].map((q) => values[a]?.[q] ?? 0)));
  const step = max > 4_000_000 ? 2_000_000 : max > 2_000_000 ? 1_000_000 : max > 400_000 ? 200_000 : 50_000;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {agents.map((a, i) => (
          <span key={a} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[i] }} aria-hidden />
            <span className="font-medium text-[var(--ink)]">{a}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex h-56 flex-col justify-between pb-6 text-right text-[11px] text-[var(--muted)]">
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {short(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((t) => (
              <span key={t} className="border-t border-[var(--line)]" />
            ))}
          </div>
          <div className="relative grid h-56 grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4].map((q) => (
              <div key={q} className="flex flex-col">
                <div className="flex flex-1 items-end justify-center gap-0.5 sm:gap-1">
                  {agents.map((a, i) => {
                    const v = values[a]?.[q] ?? 0;
                    return (
                      <div
                        key={a}
                        title={`${a} · Q${q}: ${formatLkr(v)}`}
                        className="w-full max-w-12 rounded-t transition-opacity hover:opacity-80"
                        style={{ height: `${(v / top) * 100}%`, background: colors[i], minHeight: v ? 2 : 0 }}
                      />
                    );
                  })}
                </div>
                <span className="h-6 pt-1.5 text-center text-xs text-[var(--muted)]">Q{q}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
