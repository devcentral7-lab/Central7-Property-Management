import Link from "next/link";
import type { ReactNode } from "react";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";
import { BRAND, seriesColor, statusColor } from "@/app/app/dashboard/palette";
import { RefSearch } from "@/app/app/dashboard/ref-search";
import { Icon, StatCard, type IconName } from "@/app/app/user-management/ui";
import { StatusBadge } from "@/components/status-badge";
import type { CountRow, UserDashboardData } from "@/lib/user-dashboard";

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
      <div className="flex-1 p-4 sm:p-5">{children}</div>
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

export function UserDashboard({ name, data }: { name: string; data: UserDashboardData }) {
  const activeShare = pct(data.active, data.total);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">My dashboard</p>
          <h1 className="font-display text-2xl font-semibold text-[var(--brand-deep)] sm:text-3xl">
            Welcome Back, {name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here’s how your listings are doing.</p>
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
