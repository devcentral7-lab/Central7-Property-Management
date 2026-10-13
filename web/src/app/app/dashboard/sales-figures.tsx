import { BRAND } from "@/app/app/dashboard/palette";
import {
  currentMonth,
  currentYear,
  formatLkr,
  type PerformancePeriod,
  type SalesFigures,
} from "@/lib/finance-shared";

const QUARTER_COLORS = [BRAND.red, BRAND.charcoal, BRAND.redSoft, BRAND.stone];

/** Sales value for the period and Q1–Q4 tiles for its year; place inside an `@container`. */
export function SalesFiguresView({
  figures,
  period,
  valueLabel,
  quartersLabel,
}: {
  figures: SalesFigures;
  period: PerformancePeriod;
  valueLabel: string;
  quartersLabel: string;
}) {
  const thisQuarter = period.year === currentYear() ? Math.ceil(currentMonth() / 3) : 0;
  return (
    <>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-[var(--sidebar)] px-5 py-4 text-white">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/70">
            {valueLabel} · {period.label}
          </p>
          <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{formatLkr(figures.sales_value)}</p>
        </div>
        <p className="text-xs text-white/60">
          {figures.invoices.toLocaleString()} {figures.invoices === 1 ? "invoice" : "invoices"}
        </p>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {quartersLabel} · {period.year}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 @xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => {
          const amount = figures.quarterly[i] ?? 0;
          const now = thisQuarter === i + 1;
          return (
            <div
              key={i}
              className={`relative min-w-0 rounded-xl border bg-[var(--card)] py-3 pl-4 pr-3 ${
                now ? "border-[var(--brand)]/40 bg-[var(--brand)]/[0.03]" : "border-[var(--line)]"
              }`}
            >
              <span
                aria-hidden
                className="absolute inset-y-3 left-0 w-1 rounded-r-full"
                style={{ background: QUARTER_COLORS[i] }}
              />
              <p className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--muted)]">
                Q{i + 1}
                {now ? (
                  <span className="rounded-full bg-[var(--brand)]/10 px-1.5 py-px text-[10px] font-semibold text-[var(--brand-deep)]">
                    Now
                  </span>
                ) : null}
              </p>
              <p
                className={`mt-1 truncate font-display text-lg font-semibold tabular-nums ${
                  amount ? "text-[var(--ink)]" : "text-[var(--muted)]"
                }`}
              >
                {formatLkr(amount)}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
