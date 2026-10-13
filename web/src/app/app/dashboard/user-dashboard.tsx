import Link from "next/link";
import type { ReactNode } from "react";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";
import { BRAND, seriesColor, statusColor } from "@/app/app/dashboard/palette";
import { PerformanceFilters } from "@/app/app/dashboard/performance-filters";
import { RefSearch } from "@/app/app/dashboard/ref-search";
import { Icon, StatCard, type IconName } from "@/app/app/user-management/ui";
import { StatusBadge } from "@/components/status-badge";
import {
  currentMonth,
  currentYear,
  formatLkr,
  type MyPerformance,
  type PerformancePeriod,
} from "@/lib/finance-shared";
import type { CountRow, UserDashboardData } from "@/lib/user-dashboard";

export type PerformanceView = {
  data: MyPerformance | null;
  error: string | null;
  period: PerformancePeriod;
  years: number[];
};

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

function money(n: number | null, currency: string) {
  if (n === null || n === undefined) return "Price on request";
  return `${currency} ${Number(n).toLocaleString("en-US")}`;
}

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold">{title}</h2>
            {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="@container flex-1 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-[var(--muted)]">{children}</p>;
}

function StatusBreakdown({ rows, total }: { rows: CountRow[]; total: number }) {
  if (!total) return <EmptyNote>No listings yet.</EmptyNote>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--bg-accent)]">
        {rows.map((r, i) => (
          <span
            key={r.name}
            title={`${r.name}: ${r.count.toLocaleString()}`}
            style={{ width: `${(r.count / total) * 100}%`, backgroundColor: statusColor(r.name, i) }}
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {rows.map((r, i) => (
          <li key={r.name}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor(r.name, i) }} />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{r.count.toLocaleString()}</span>
                <span className="ml-1.5 text-xs text-[var(--muted)]">{pct(r.count, total)}%</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ rows, total }: { rows: CountRow[]; total: number }) {
  if (!rows.length) return <EmptyNote>Nothing to show yet.</EmptyNote>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{r.count.toLocaleString()}</span>
              <span className="ml-1.5 text-xs text-[var(--muted)]">{pct(r.count, total)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--bg-accent)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, backgroundColor: seriesColor(i) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function OpportunitySplit({ rows, total }: { rows: CountRow[]; total: number }) {
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((r, i) => (
        <div key={r.name} className="rounded-xl bg-[var(--bg)] px-3 py-2.5">
          <p className="text-xs text-[var(--muted)]">{r.name === "Sell" ? "For sale" : r.name === "Rent Out" ? "For rent" : r.name}</p>
          <p className="font-display text-xl font-semibold tabular-nums" style={{ color: i === 0 ? BRAND.red : BRAND.charcoal }}>
            {r.count.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--muted)]">{pct(r.count, total)}% of listings</p>
        </div>
      ))}
    </div>
  );
}

const QUARTER_COLORS = [BRAND.red, BRAND.charcoal, BRAND.redSoft, BRAND.stone];

function MyPerformancePanel({ view }: { view: PerformanceView }) {
  const { data, period } = view;
  const thisQuarter = period.year === currentYear() ? Math.ceil(currentMonth() / 3) : 0;
  return (
    <Panel title="My Performance" subtitle="Sales credited to you" icon="trend">
      <PerformanceFilters period={period} years={view.years} />
      {data ? (
        <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-[var(--sidebar)] px-5 py-4 text-white">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/70">Sales value · {period.label}</p>
              <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{formatLkr(data.sales_value)}</p>
            </div>
            <p className="text-xs text-white/60">
              {data.invoices.toLocaleString()} {data.invoices === 1 ? "invoice" : "invoices"}
            </p>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            My quarterly sales · {period.year}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 @xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => {
              const amount = data.quarterly[i] ?? 0;
              return (
                <div
                  key={i}
                  className={`relative min-w-0 rounded-xl border bg-[var(--card)] py-3 pl-4 pr-3 ${
                    thisQuarter === i + 1 ? "border-[var(--brand)]/40 bg-[var(--brand)]/[0.03]" : "border-[var(--line)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-3 left-0 w-1 rounded-r-full"
                    style={{ background: QUARTER_COLORS[i] }}
                  />
                  <p className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--muted)]">
                    Q{i + 1}
                    {thisQuarter === i + 1 ? (
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
      ) : (
        <p className="mt-5 rounded-xl bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
          {view.error ?? "Your sales figures will show here once an admin links your login to a finance agent."}
        </p>
      )}
    </Panel>
  );
}

function TargetPanel({ view }: { view: PerformanceView }) {
  const { data, period } = view;
  const year = period.year;
  const title = `Your ${year} Target`;
  if (!data) return null;
  if (!data.target) {
    return (
      <Panel title={title} subtitle="Yearly sales target" icon="target">
        <EmptyNote>No target has been set for {year} yet.</EmptyNote>
      </Panel>
    );
  }

  const target = data.target;
  const achieved = data.quarterly.reduce((s, q) => s + q, 0);
  const remaining = Math.max(target - achieved, 0);
  const progress = Math.round((achieved / target) * 100);
  const thisYear = currentYear();
  const monthsLeft = year === thisYear ? 12 - currentMonth() + 1 : year > thisYear ? 12 : 0;
  const neededPerMonth = remaining && monthsLeft ? remaining / monthsLeft : 0;
  const note =
    remaining === 0
      ? `Target reached, ${formatLkr(achieved - target)} above target.`
      : monthsLeft === 0
        ? `${year} ended ${formatLkr(remaining)} short of the target.`
        : `Average about ${formatLkr(neededPerMonth)} per month for the rest of the year to hit your target.`;

  return (
    <Panel title={title} subtitle="Yearly sales target" icon="target">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--muted)]">Remaining target</p>
          <p className="truncate font-display text-2xl font-semibold tabular-nums text-[var(--brand)] sm:text-3xl">
            {formatLkr(remaining)}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--muted)]">Achieved so far</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-emerald-700 sm:text-3xl">{progress}%</p>
        </div>
      </div>

      <div
        className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--bg-accent)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(progress, 100)}
        aria-label={`${progress}% of the ${year} target achieved`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: remaining === 0 ? BRAND.active : `linear-gradient(90deg, ${BRAND.redDeep}, ${BRAND.red})`,
          }}
        />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          ["Target", formatLkr(target)],
          ["Achieved (year)", formatLkr(achieved)],
          ["Needed / month", monthsLeft && remaining ? formatLkr(neededPerMonth) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-[var(--muted)]">{note}</p>
    </Panel>
  );
}

export function UserDashboard({
  name,
  data,
  performance,
}: {
  name: string;
  data: UserDashboardData;
  performance: PerformanceView;
}) {
  const activeShare = pct(data.active, data.total);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">My dashboard</p>
          <h1 className="font-display text-2xl font-semibold text-[var(--brand-deep)] sm:text-3xl">
            Welcome Back, {name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here’s how your sales and listings are doing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/add-property"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-deep)]"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add property
          </Link>
          <Link
            href="/app/properties"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-accent)]"
          >
            <Icon name="search" className="h-4 w-4" />
            Search properties
          </Link>
        </div>
      </header>

      <div className={`grid gap-4 ${performance.data ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : ""}`}>
        <MyPerformancePanel view={performance} />
        <TargetPanel view={performance} />
      </div>

      <RefSearch />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/app/my-properties" className="rounded-2xl transition hover:brightness-110">
          <StatCard label="My listings" value={data.total} hint="View all my properties" icon="building" accent />
        </Link>
        <StatCard label="Active" value={data.active} hint={`${activeShare}% of my listings`} icon="check" />
        <StatCard label="Added this month" value={data.addedThisMonth} icon="calendar" />
        <StatCard label="Last 30 days" value={data.addedLast30} hint="New listings" icon="clock" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Listings By Status" subtitle={`${data.total.toLocaleString()} listings`} icon="check">
          <StatusBreakdown rows={data.byStatus} total={data.total} />
        </Panel>
        <Panel title="Portfolio Mix" subtitle="Property types and deal type" icon="building">
          <div className="space-y-5">
            <OpportunitySplit rows={data.byOpportunity} total={data.total} />
            <BarList rows={data.byType} total={data.total} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title="Recently Added"
          subtitle="Your latest listings"
          icon="plus"
          action={
            <Link href="/app/my-properties" className="shrink-0 text-sm font-semibold text-[var(--brand-deep)] hover:underline">
              View all
            </Link>
          }
        >
          {data.recent.length ? (
            <ul className="-mx-4 -my-4 divide-y divide-[var(--line)] sm:-mx-5 sm:-my-5">
              {data.recent.map((r) => (
                <PropertyRow key={r.id} refNo={r.ref_no} as="li" className="px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
                      <p className="truncate text-sm">
                        {r.property_type} · {r.opportunity_type === "Rent Out" ? "For rent" : "For sale"} · {r.city || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={r.status} className="text-xs" />
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{DAY.format(new Date(r.created_at))}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{money(r.price_total, r.currency)}</p>
                </PropertyRow>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-[var(--muted)]">You haven’t added any listings yet.</p>
              <Link href="/app/add-property" className="mt-3 inline-block text-sm font-semibold text-[var(--brand-deep)] hover:underline">
                Add your first property
              </Link>
            </div>
          )}
        </Panel>

        <Panel title="My Recent Activity" subtitle="Status updates you made" icon="clock">
          {data.activity.length ? (
            <ol className="relative space-y-4 border-l border-[var(--line)] pl-5">
              {data.activity.map((e, i) => (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--card)] ${
                      i === 0 ? "bg-[var(--brand)]" : "bg-stone-300"
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm">
                      <span className="font-semibold">{e.action}</span>{" "}
                      <span className="text-[var(--muted)]">on</span>{" "}
                      <PropertyLink refNo={e.ref_no}>{e.ref_no}</PropertyLink>
                    </p>
                    <p className="text-xs text-[var(--muted)]">{WHEN.format(new Date(e.occurred_at))}</p>
                  </div>
                  {e.comment ? <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{e.comment}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyNote>No status updates yet.</EmptyNote>
          )}
        </Panel>
      </div>
    </div>
  );
}
