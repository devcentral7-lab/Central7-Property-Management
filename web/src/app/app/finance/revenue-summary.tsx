import Link from "next/link";
import { BRAND } from "@/app/app/dashboard/palette";
import { formatLkr, type FinanceDashboard } from "@/lib/finance-shared";

export const TYPE_COLOR: Record<string, string> = {
  Sale: BRAND.red,
  Rental: BRAND.charcoal,
  "Management Fee": BRAND.redSoft,
  "Car Park": BRAND.stone,
  Other: BRAND.stoneLight,
};

function Tile({
  label,
  value,
  detail,
  color,
  valueClass = "text-[var(--ink)]",
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  color: string;
  valueClass?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: color }} />
      <p className="text-xs font-medium leading-snug text-[var(--muted)] sm:text-[13px]">{label}</p>
      <div className="mt-auto pt-2">
        <p className={`font-display text-2xl font-semibold tabular-nums sm:text-3xl ${valueClass}`}>{value}</p>
        {detail ? <p className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">{detail}</p> : null}
      </div>
    </>
  );
  const className =
    "relative flex min-h-[104px] min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] py-3 pl-4 pr-3 transition";
  return href ? (
    <Link
      href={href}
      className={`${className} hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[0.02] hover:shadow-sm`}
    >
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/** Revenue-type tiles, share bar and invoiced / received / outstanding totals. */
export function RevenueSummary({
  dashboard,
  typeHref,
  outstandingHref,
}: {
  dashboard: FinanceDashboard;
  typeHref?: (type: string) => string;
  outstandingHref?: string;
}) {
  const { totals } = dashboard;
  const typeTotal = dashboard.by_type.reduce((s, t) => s + Number(t.amount), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {dashboard.by_type.map((t) => (
          <Tile
            key={t.type}
            label={t.type}
            value={Number(t.count).toLocaleString()}
            detail={formatLkr(t.amount)}
            color={TYPE_COLOR[t.type]}
            valueClass={t.type === "Sale" ? "text-[var(--brand)]" : Number(t.count) ? "text-[var(--ink)]" : "text-[var(--muted)]"}
            href={typeHref?.(t.type)}
          />
        ))}
      </div>

      <div>
        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--bg-accent)]">
          {dashboard.by_type.map((t) =>
            Number(t.amount) > 0 ? (
              <span
                key={t.type}
                title={`${t.type}: ${formatLkr(t.amount)}`}
                style={{ width: `${(Number(t.amount) / typeTotal) * 100}%`, background: TYPE_COLOR[t.type] }}
              />
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          {dashboard.by_type.map((t) => (
            <span key={t.type} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t.type] }} aria-hidden />
              {t.type}
              <span className="font-semibold tabular-nums text-[var(--ink)]">
                {typeTotal ? Math.round((Number(t.amount) / typeTotal) * 100) : 0}%
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Total invoiced" value={formatLkr(totals.invoiced)} color={BRAND.charcoal} />
        <Tile label="Total received" value={formatLkr(totals.received)} color={BRAND.active} />
        <Tile
          label="Outstanding"
          value={formatLkr(totals.outstanding)}
          color={totals.outstanding > 0 ? BRAND.red : BRAND.stonePale}
          valueClass={totals.outstanding > 0 ? "text-[var(--brand)]" : "text-[var(--muted)]"}
          href={outstandingHref}
        />
      </div>
    </div>
  );
}
