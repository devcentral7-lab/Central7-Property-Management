import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LinkRow } from "@/components/clickable-row";
import { StatusBadge } from "@/components/status-badge";
import type { AdminAnalytics, AgentContactSplit } from "@/lib/analytics";
import { PeriodSelect } from "@/app/app/dashboard/period-select";
import {
  ColumnChart,
  DonutChart,
  HBarChart,
  StackedBarChart,
  TrendChart,
} from "@/app/app/dashboard/charts";
import {
  DashboardTabs,
  type DashboardView,
} from "@/app/app/dashboard/dashboard-tabs";
import {
  BRAND,
  rankColors,
  seriesColor,
  statusColor,
} from "@/app/app/dashboard/palette";

type IconName = "grid" | "user" | "share" | "clock" | "table" | "chart";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z",
    share:
      "M18 8a3 3 0 1 0-3-3M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    table: "M3 5h18v14H3zM3 10h18M9 10v9",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroStats({
  total,
  active,
  added,
  period,
}: {
  total: number;
  active: number;
  added: number;
  period: string;
}) {
  const activeShare = total ? (active / total) * 100 : 0;
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      <Link
        href="/app/properties"
        className="group relative overflow-hidden rounded-2xl bg-[var(--sidebar)] p-5 text-white transition hover:brightness-110 sm:p-6"
      >
        <span
          aria-hidden
          className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[var(--brand)]/25 blur-2xl"
        />
        <p className="relative text-sm font-medium text-white/65">Total listings</p>
        <p className="relative mt-2 font-display text-4xl font-semibold tabular-nums">
          {total.toLocaleString()}
        </p>
        <p className="relative mt-1 text-xs text-white/55">All time · every status</p>
      </Link>

      <Link
        href="/app/properties?status=Active"
        className="relative overflow-hidden rounded-2xl bg-[var(--brand)] p-5 text-white transition hover:bg-[var(--brand-deep)] sm:p-6"
      >
        <p className="text-sm font-medium text-white/80">Active listings</p>
        <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
          {active.toLocaleString()}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${activeShare}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-white/80">
          {activeShare.toFixed(1)}% of all listings
        </p>
      </Link>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6">
        <p className="text-sm font-medium text-[var(--muted)]">Added</p>
        <p className="mt-2 font-display text-4xl font-semibold tabular-nums text-[var(--ink)]">
          {added.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">{period}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections & stat tiles                                               */
/* ------------------------------------------------------------------ */

function Section({
  title,
  subtitle,
  icon,
  aside,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      open
      className="group min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
          <Icon name={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold leading-tight">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block text-xs text-[var(--muted)]">{subtitle}</span>
          ) : null}
        </span>
        {aside}
        <Chevron />
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </details>
  );
}

type Tone = "brand" | "ink" | "muted" | "attention";

type Tile = {
  label: string;
  value: number;
  tone: Tone;
  href?: string;
};

const TONE_BAR: Record<Tone, string> = {
  brand: BRAND.red,
  ink: BRAND.charcoal,
  muted: BRAND.stoneLight,
  attention: BRAND.red,
};

function StatTile({ label, value, tone, href }: Tile) {
  const needsAction = tone === "attention" && value > 0;
  const numberColor =
    tone === "brand" || needsAction
      ? "text-[var(--brand)]"
      : tone === "muted" || (tone === "attention" && value === 0)
        ? "text-[var(--muted)]"
        : "text-[var(--ink)]";
  const bar = tone === "attention" && value === 0 ? BRAND.stonePale : TONE_BAR[tone];

  const inner = (
    <>
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-1 rounded-r-full"
        style={{ background: bar }}
      />
      <p className="text-xs font-medium leading-snug text-[var(--muted)] sm:text-[13px]">
        {label}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <p className={`font-display text-3xl font-semibold tabular-nums ${numberColor}`}>
          {value.toLocaleString()}
        </p>
        {needsAction ? (
          <span className="mb-1 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
            To do
          </span>
        ) : null}
      </div>
    </>
  );
  const className =
    "relative flex min-h-[104px] min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] py-3 pl-4 pr-3 transition";
  if (href) {
    return (
      <Link
        href={href}
        className={`${className} hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[0.02] hover:shadow-sm`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function TileGroup({
  title,
  hint,
  icon,
  tiles,
  cols,
}: {
  title: string;
  hint: string;
  icon: IconName;
  tiles: Tile[];
  cols: string;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon name={icon} className="h-3.5 w-3.5 text-[var(--muted)]" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink)]">
          {title}
        </h3>
        <span className="text-xs text-[var(--muted)]">· {hint}</span>
      </div>
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function AgentCard({
  agent,
  rank,
  max,
}: {
  agent: AgentContactSplit;
  rank: number;
  max: number;
}) {
  const known = agent.direct + agent.partner;
  const directPct = pct(agent.direct, known);
  const partnerPct = known ? 100 - directPct : 0;
  const leader = rank === 1;
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 ${
        leader
          ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.03]"
          : "border-[var(--line)] bg-[var(--card)]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            leader ? "bg-[var(--brand)] text-white" : "bg-[var(--bg-accent)] text-[var(--ink)]"
          }`}
        >
          {agent.name.slice(0, 1).toUpperCase()}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{agent.name}</p>
        <span className="text-xs font-semibold tabular-nums text-[var(--muted)]">#{rank}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p
          className={`font-display text-3xl font-semibold tabular-nums ${
            leader ? "text-[var(--brand)]" : "text-[var(--ink)]"
          }`}
        >
          {agent.total.toLocaleString()}
        </p>
        <p className="text-xs text-[var(--muted)]">listings</p>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--bg-accent)]">
        <div
          className="h-full rounded-full bg-[var(--ink)]/20"
          style={{ width: `${max ? (agent.total / max) * 100 : 0}%` }}
        />
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--bg-accent)]">
        {known ? (
          <>
            <div style={{ width: `${directPct}%`, background: BRAND.charcoal }} />
            <div style={{ width: `${partnerPct}%`, background: BRAND.red }} />
          </>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[var(--muted)]">
          <span className="h-2 w-2 rounded-full" style={{ background: BRAND.charcoal }} />
          Direct{" "}
          <span className="font-semibold tabular-nums text-[var(--ink)]">
            {agent.direct.toLocaleString()}
          </span>
          <span className="tabular-nums">({directPct}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--muted)]">
          <span className="h-2 w-2 rounded-full" style={{ background: BRAND.red }} />
          Partner{" "}
          <span className="font-semibold tabular-nums text-[var(--ink)]">
            {agent.partner.toLocaleString()}
          </span>
          <span className="tabular-nums">({partnerPct}%)</span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables & chart panels                                               */
/* ------------------------------------------------------------------ */

function Row({ href, children }: { href?: string; children: ReactNode }) {
  const className = "border-t border-[var(--line)]";
  return href ? (
    <LinkRow href={href} className={className}>
      {children}
    </LinkRow>
  ) : (
    <tr className={className}>{children}</tr>
  );
}

function NumberTable({
  title,
  subtitle,
  rows,
  hrefFor,
  colorFor,
}: {
  title: string;
  subtitle?: string;
  rows: { name: string; value: number }[];
  hrefFor?: (name: string) => string;
  colorFor?: (name: string, index: number) => string;
}) {
  const sum = rows.reduce((acc, r) => acc + r.value, 0);
  return (
    <Section title={title} subtitle={subtitle} icon="table">
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <th className="pb-2 pr-3 font-semibold">Name</th>
              <th className="hidden pb-2 pr-3 font-semibold sm:table-cell">Share</th>
              <th className="pb-2 pr-3 text-right font-semibold">Count</th>
              <th className="pb-2 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const share = sum ? (r.value / sum) * 100 : 0;
              const color = colorFor ? colorFor(r.name, i) : BRAND.red;
              return (
                <Row key={r.name} href={hrefFor?.(r.name)}>
                  <td className="max-w-0 truncate py-2.5 pr-3">
                    {r.name.toLowerCase() === "active" ? (
                      hrefFor ? (
                        <Link href={hrefFor(r.name)} className="hover:underline">
                          <StatusBadge status={r.name} className="font-normal" />
                        </Link>
                      ) : (
                        <StatusBadge status={r.name} className="font-normal" />
                      )
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                        {hrefFor ? (
                          <Link
                            href={hrefFor(r.name)}
                            className="truncate hover:text-[var(--brand)] hover:underline"
                          >
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </span>
                    )}
                  </td>
                  <td className="hidden w-[38%] py-2.5 pr-3 sm:table-cell">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-accent)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${share}%`, background: color }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                    {r.value.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-[var(--muted)]">
                    {share < 0.1 && share > 0 ? "<0.1" : share.toFixed(1)}
                  </td>
                </Row>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--line)]">
              <td className="pt-2.5 pr-3 font-semibold">Total</td>
              <td className="hidden sm:table-cell" />
              <td className="pt-2.5 pr-3 text-right font-semibold tabular-nums">
                {sum.toLocaleString()}
              </td>
              <td className="pt-2.5 text-right tabular-nums text-[var(--muted)]">100</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="text-sm text-[var(--muted)]">No data yet.</p>
      )}
    </Section>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
          <Icon name="chart" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AdminDashboard({
  data,
  view = "stats",
}: {
  data: AdminAnalytics;
  view?: DashboardView;
}) {
  const { kpis, overview: ov } = data;
  const period = data.rangeLabel;
  const socialOpen =
    ov.publish_on_social +
    ov.republish_on_social +
    ov.drop_to_update_social +
    ov.lost_to_update_social;
  const approvalsOpen = ov.publish_pending_approval + ov.republish_pending_approval;
  const agentMax = Math.max(...data.byAgent.map((a) => a.total), 0);

  const stats = (
    <div className="space-y-4 sm:space-y-5">
      <HeroStats
        total={kpis.total}
        active={kpis.active}
        added={ov.properties_added}
        period={period}
      />

      <Section
        title="Company overview"
        subtitle={`${period} activity and what's waiting now`}
        icon="grid"
        aside={
          socialOpen + approvalsOpen > 0 ? (
            <span className="hidden rounded-full bg-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-white sm:inline">
              {(socialOpen + approvalsOpen).toLocaleString()} waiting
            </span>
          ) : null
        }
      >
        <div className="space-y-5">
          <TileGroup
            title="Listing activity"
            hint={period}
            icon="chart"
            cols="sm:grid-cols-3 xl:grid-cols-6"
            tiles={[
              { label: "Properties added", value: ov.properties_added, tone: "brand", href: "/app/properties" },
              { label: "Published by social media", value: ov.published_by_social, tone: "ink", href: "/app/social-queue?tab=published" },
              { label: "Republished", value: ov.republished, tone: "ink" },
              { label: "Closed", value: ov.closed, tone: "ink" },
              { label: "Dropped", value: ov.dropped, tone: "muted" },
              { label: "Lost", value: ov.lost, tone: "muted" },
            ]}
          />
          <TileGroup
            title="Social media queue"
            hint="approved, waiting to be posted"
            icon="share"
            cols="lg:grid-cols-4"
            tiles={[
              { label: "Publish on social media", value: ov.publish_on_social, tone: "attention", href: "/app/social-queue" },
              { label: "Republish on social media", value: ov.republish_on_social, tone: "attention", href: "/app/social-queue" },
              { label: "Drop properties to update on social media", value: ov.drop_to_update_social, tone: "attention", href: "/app/social-queue" },
              { label: "Lost properties to update on social media", value: ov.lost_to_update_social, tone: "attention", href: "/app/social-queue" },
            ]}
          />
          <TileGroup
            title="Awaiting approval"
            hint="on the Activity log"
            icon="clock"
            cols="lg:grid-cols-4"
            tiles={[
              { label: "Publish pending approval", value: ov.publish_pending_approval, tone: "attention", href: "/app/activity?category=social" },
              { label: "Republish pending approval", value: ov.republish_pending_approval, tone: "attention", href: "/app/activity?category=social" },
            ]}
          />
        </div>
      </Section>

      <Section
        title="Properties added by agent"
        subtitle={`${period} · Direct vs Partner contacts`}
        icon="user"
      >
        {data.byAgent.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.byAgent.map((a, i) => (
              <AgentCard key={a.name} agent={a} rank={i + 1} max={agentMax} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No listings added in this period.</p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <NumberTable
          title="Listings by status"
          subtitle="Current inventory"
          rows={data.byStatus}
          colorFor={statusColor}
          hrefFor={(s) => `/app/properties?status=${encodeURIComponent(s)}`}
        />
        <NumberTable
          title="Listings by type"
          subtitle="Current inventory"
          rows={data.byType}
          colorFor={(_, i) => (i === 0 ? BRAND.red : i === 1 ? BRAND.charcoal : BRAND.stone)}
          hrefFor={(t) => `/app/properties?property_type=${encodeURIComponent(t)}`}
        />
      </div>
    </div>
  );

  const statusNames = data.byStatus.map((s) => s.name);
  const statusColors = data.byStatus.map((s, i) => statusColor(s.name, i));
  const statusByTypeRows = data.byType.map((t) => ({
    label: t.name,
    values: Object.fromEntries(
      data.statusByType
        .filter((r) => r.type === t.name)
        .map((r) => [r.status, r.value]),
    ),
  }));
  const agentSplitRows = data.byAgent.map((a) => ({
    label: a.name,
    values: { Direct: a.direct, Partner: a.partner },
  }));

  const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekdayTotals = weekdayNames.map((name) => ({ name, value: 0 }));
  for (const d of data.byDay) {
    const js = new Date(`${d.day}T00:00:00Z`).getUTCDay();
    weekdayTotals[(js + 6) % 7].value += d.count;
  }
  const busiestWeekday = Math.max(...weekdayTotals.map((w) => w.value));

  const outcomes = [
    { name: "Added", value: ov.properties_added },
    { name: "Republished", value: ov.republished },
    { name: "Closed", value: ov.closed },
    { name: "Dropped", value: ov.dropped },
    { name: "Lost", value: ov.lost },
  ];
  const pipeline = [
    { name: "Awaiting approval", value: approvalsOpen },
    { name: "Waiting to post", value: socialOpen },
    { name: `Posted (${period.toLowerCase()})`, value: ov.published_by_social },
  ];

  const visuals = (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Status mix" subtitle="Current inventory · hover a slice or row">
          <DonutChart data={data.byStatus} colors={statusColors} />
        </ChartPanel>
        <ChartPanel title="Sell vs rent" subtitle="Current inventory by opportunity">
          <DonutChart
            data={data.byOpportunity}
            colors={data.byOpportunity.map((_, i) => seriesColor(i))}
          />
        </ChartPanel>
      </div>

      <ChartPanel title="Listings added" subtitle={`${period} · per day, dashed line = daily average`}>
        <TrendChart data={data.byDay} />
      </ChartPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Property types" subtitle="Current inventory">
          <HBarChart data={data.byType} colors={rankColors(data.byType.length)} />
        </ChartPanel>
        <ChartPanel title="Status by property type" subtitle="Current inventory · hover a segment">
          <StackedBarChart rows={statusByTypeRows} keys={statusNames} colors={statusColors} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Top creators" subtitle={`${period} · listings added`}>
          <HBarChart
            data={data.byCreator}
            colors={rankColors(data.byCreator.length)}
            ranked
            emptyLabel="No listings added in this period"
          />
        </ChartPanel>
        <ChartPanel title="Direct vs partner by agent" subtitle={`${period} · listings added`}>
          <StackedBarChart
            rows={agentSplitRows}
            keys={["Direct", "Partner"]}
            colors={[BRAND.charcoal, BRAND.red]}
          />
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Listing outcomes" subtitle={`${period} · status changes`}>
          <ColumnChart
            data={outcomes}
            colors={[BRAND.red, BRAND.charcoal, BRAND.redDark, BRAND.stone, BRAND.stoneLight]}
          />
        </ChartPanel>
        <ChartPanel title="Social media pipeline" subtitle="Where queue items are right now">
          <HBarChart
            data={pipeline}
            colors={[BRAND.stoneLight, BRAND.redSoft, BRAND.red]}
            unit="Items"
          />
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel
          title="Top cities"
          subtitle={`Active listings${data.activeCitiesOther ? ` · ${data.activeCitiesOther.toLocaleString()} more tagged "Other"` : ""}`}
        >
          <HBarChart
            data={data.activeCities}
            colors={rankColors(data.activeCities.length)}
            ranked
            emptyLabel="No active listings"
          />
        </ChartPanel>
        <ChartPanel title="Busiest weekdays" subtitle={`${period} · listings added`}>
          <ColumnChart
            data={weekdayTotals}
            colors={weekdayTotals.map((w) =>
              busiestWeekday > 0 && w.value === busiestWeekday ? BRAND.red : BRAND.stoneLight,
            )}
          />
        </ChartPanel>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
            Admin dashboard
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            Operations overview
          </h1>
        </div>
        <Suspense fallback={null}>
          <PeriodSelect period={data.period} />
        </Suspense>
      </div>

      <DashboardTabs initialView={view} stats={stats} visuals={visuals} />
    </div>
  );
}
