import Link from "next/link";
import type { AdminAnalytics } from "@/lib/analytics";
import {
  CreatorBars,
  ListingsTrend,
  StatusDonut,
  TypeBars,
} from "@/app/app/dashboard/charts";

function Kpi({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </>
  );
  const className =
    "rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 transition hover:border-[var(--brand)]";
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function Panel({
  title,
  subtitle,
  children,
  legend,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  legend?: { name: string; value: number; color: string }[];
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {legend?.length ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
            {legend.slice(0, 6).map((l) => (
              <li key={l.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: l.color }}
                />
                {l.name} ({l.value.toLocaleString()})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const STATUS_COLORS = [
  "#0f6b4c",
  "#c45c26",
  "#0a4633",
  "#5c6b62",
  "#2a8f6a",
  "#a33b3b",
];

export function AdminDashboard({
  data,
  name,
}: {
  data: AdminAnalytics;
  name: string;
}) {
  const { kpis } = data;
  const outcomeTotal =
    kpis.dropped + kpis.lost + kpis.closed + kpis.republishEvents;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">Admin</p>
          <h1 className="font-display text-4xl font-semibold text-[var(--brand-deep)]">
            Operations overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Welcome, {name}. Charts use SQL aggregates only — no full inventory
            download. Window: {data.rangeLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/listings"
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Add listing
          </Link>
          <Link
            href="/app/properties"
            className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold"
          >
            Search
          </Link>
          <Link
            href="/app/activity"
            className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold"
          >
            Activity
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total listings" value={kpis.total} href="/app/properties" />
        <Kpi
          label="Active"
          value={kpis.active}
          href="/app/properties?status=Active"
        />
        <Kpi label="Added" value={kpis.added30d} hint={data.rangeLabel} />
        <Kpi
          label="Social queue"
          value={kpis.socialOpen}
          href="/app/social-queue"
        />
        <Kpi
          label="Republish queue"
          value={kpis.republishOpen}
          href="/app/republish-queue"
        />
        <Kpi
          label="Drop / Lost / Closed"
          value={kpis.dropped + kpis.lost + kpis.closed}
          hint={`${outcomeTotal.toLocaleString()} status events incl. republish`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Status mix"
          subtitle="Current inventory"
          legend={data.byStatus.map((s, i) => ({
            ...s,
            color: STATUS_COLORS[i % STATUS_COLORS.length],
          }))}
        >
          <StatusDonut data={data.byStatus} />
        </Panel>
        <Panel title="Property types" subtitle="Current inventory">
          <TypeBars data={data.byType} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Listings added" subtitle={data.rangeLabel}>
          <ListingsTrend data={data.byDay} />
        </Panel>
        <Panel title="Top creators" subtitle={`${data.rangeLabel} · by name`}>
          <CreatorBars data={data.byCreator} />
        </Panel>
      </div>

      <section className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-4">
        <h2 className="font-display text-lg font-semibold sm:col-span-4">
          Status outcomes · {data.rangeLabel}
        </h2>
        {(
          [
            ["Drop", kpis.dropped],
            ["Lost", kpis.lost],
            ["Closed", kpis.closed],
            ["Republish", kpis.republishEvents],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
