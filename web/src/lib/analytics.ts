import type { DashboardPeriod } from "@/lib/dashboard-period";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

export type NamedCount = { name: string; value: number };
export type DayCount = { day: string; count: number };

/** Rows (months or days) × columns (agents) of listing counts. */
export type AgentMatrix = {
  buckets: string[];
  agents: string[];
  values: Record<string, Record<string, number>>;
};

export type DoNotPublishRow = {
  ref_no: string;
  agent: string | null;
  opportunity: string;
  type: string;
  city: string | null;
  created_at: string;
};

export type SocialDailyRow = {
  day: string;
  published: number;
  republished: number;
  drop: number;
  lost: number;
  hold: number;
  closed: number;
  dataChange: number;
  remainingPublish: number;
  remainingRepublish: number;
};

export type AdminDetails = {
  yearLabel: string;
  monthLabel: string;
  monthlyByAgent: AgentMatrix;
  dailyByAgent: AgentMatrix;
  statusColumns: string[];
  typeRows: string[];
  statusByType: Record<string, Record<string, number>>;
  cities: NamedCount[];
  doNotPublish: DoNotPublishRow[];
  socialDaily: SocialDailyRow[];
};

export type CompanyOverview = {
  properties_added: number;
  published_by_social: number;
  republished: number;
  closed: number;
  dropped: number;
  lost: number;
  publish_on_social: number;
  republish_on_social: number;
  drop_to_update_social: number;
  lost_to_update_social: number;
  publish_pending_approval: number;
  republish_pending_approval: number;
};

export type AgentContactSplit = {
  name: string;
  total: number;
  direct: number;
  partner: number;
};

export type AdminAnalytics = {
  period: DashboardPeriod;
  rangeLabel: string;
  fromIso: string;
  toIso: string;
  overview: CompanyOverview;
  byAgent: AgentContactSplit[];
  kpis: {
    total: number;
    active: number;
    added30d: number;
    socialOpen: number;
    republishOpen: number;
    dropped: number;
    lost: number;
    closed: number;
    republishEvents: number;
  };
  byStatus: NamedCount[];
  byType: NamedCount[];
  statusByType: { type: string; status: string; value: number }[];
  byOpportunity: NamedCount[];
  activeCities: NamedCount[];
  activeCitiesOther: number;
  byDay: DayCount[];
  byCreator: NamedCount[];
  details: AdminDetails;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sri Lanka is UTC+5:30 all year (no DST). */
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function periodStart(period: DashboardPeriod, now: Date): Date {
  if (period === "30d") return new Date(now.getTime() - 30 * DAY_MS);
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = period === "month" ? local.getUTCMonth() : 0;
  return new Date(Date.UTC(y, m, 1) - COLOMBO_OFFSET_MS);
}

function periodLabel(period: DashboardPeriod, from: Date): string {
  if (period === "30d") return "Last 30 days";
  const local = new Date(from.getTime() + COLOMBO_OFFSET_MS);
  return period === "month"
    ? local.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : String(local.getUTCFullYear());
}

type BucketRow = { bucket: string; agent: string; value: number | string };

function agentMatrix(rows: BucketRow[], buckets: string[]): AgentMatrix {
  const values: Record<string, Record<string, number>> = {};
  const agentTotals = new Map<string, number>();
  for (const r of rows) {
    const v = num(r.value);
    (values[r.bucket] ??= {})[r.agent] = v;
    agentTotals.set(r.agent, (agentTotals.get(r.agent) ?? 0) + v);
  }
  const agents = [...agentTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  return { buckets, agents, values };
}

type DetailsRaw = {
  monthly_by_agent?: BucketRow[];
  daily_by_agent?: BucketRow[];
  status_by_type?: { type: string; status: string; value: number | string }[];
  cities?: { name: string; value: number | string }[];
  do_not_publish?: DoNotPublishRow[];
  social_done?: { day: string; action: string; value: number | string }[];
  social_backlog?: { day: string; publish: number | string; republish: number | string }[];
};

function buildDetails(
  raw: DetailsRaw,
  options: { statuses: string[]; propertyTypes: string[] },
  now: Date,
): AdminDetails {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const year = local.getUTCFullYear();
  const months = Array.from(
    { length: local.getUTCMonth() + 1 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const monthly = raw.monthly_by_agent ?? [];
  const daily = raw.daily_by_agent ?? [];
  const days = [...new Set(daily.map((r) => r.bucket))].sort();

  const statusByType: Record<string, Record<string, number>> = {};
  const seenStatuses = new Set<string>();
  const seenTypes = new Set<string>();
  for (const r of raw.status_by_type ?? []) {
    (statusByType[r.type] ??= {})[r.status] = num(r.value);
    seenStatuses.add(r.status);
    seenTypes.add(r.type);
  }
  const withExtras = (base: string[], seen: Set<string>) => [
    ...base,
    ...[...seen].filter((s) => !base.includes(s)).sort(),
  ];

  const done = new Map<string, Record<string, number>>();
  for (const r of raw.social_done ?? []) {
    const day = String(r.day).slice(0, 10);
    const bucket = (done.get(day) ?? {}) as Record<string, number>;
    bucket[r.action] = (bucket[r.action] ?? 0) + num(r.value);
    done.set(day, bucket);
  }
  const socialDaily: SocialDailyRow[] = (raw.social_backlog ?? []).map((b) => {
    const day = String(b.day).slice(0, 10);
    const d = done.get(day) ?? {};
    return {
      day,
      published: (d["Publish"] ?? 0) + (d["New Ad Published"] ?? 0),
      republished: d["Republish"] ?? 0,
      drop: d["Drop"] ?? 0,
      lost: d["Lost"] ?? 0,
      hold: d["Hold"] ?? 0,
      closed: d["Closed"] ?? 0,
      dataChange: d["Data Change"] ?? 0,
      remainingPublish: num(b.publish),
      remainingRepublish: num(b.republish),
    };
  });

  return {
    yearLabel: String(year),
    monthLabel: local.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    monthlyByAgent: agentMatrix(monthly, months),
    dailyByAgent: agentMatrix(daily, days),
    statusColumns: withExtras(options.statuses, seenStatuses),
    typeRows: withExtras(options.propertyTypes, seenTypes),
    statusByType,
    cities: (raw.cities ?? []).map((c) => ({ name: String(c.name), value: num(c.value) })),
    doNotPublish: raw.do_not_publish ?? [],
    socialDaily,
  };
}

/** Aggregate-only Admin home metrics — never downloads property rows. */
export async function loadAdminAnalytics(
  period: DashboardPeriod = "30d",
): Promise<AdminAnalytics> {
  const supabase = await createClient();
  const to = new Date();
  const from = periodStart(period, to);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [
    kpiRes,
    countsRes,
    dayRes,
    creatorRes,
    eventsRes,
    socialRes,
    republishRes,
    overviewRes,
    agentRes,
    breakdownRes,
    detailsRes,
    options,
  ] = await Promise.all([
    supabase.rpc("inventory_kpi_counts"),
    supabase.rpc("dashboard_listing_counts"),
    supabase.rpc("listings_created_by_day", {
      p_from: fromIso,
      p_to: toIso,
    }),
    supabase.rpc("listings_by_creator", {
      p_from: fromIso,
      p_to: toIso,
      p_limit: 8,
    }),
    supabase.rpc("status_event_action_counts", {
      p_from: fromIso,
      p_to: toIso,
      p_actions: ["Drop", "Lost", "Closed", "Republish"],
    }),
    supabase
      .from("social_media_queue")
      .select("*", { count: "exact", head: true })
      .not("approved_at", "is", null)
      .is("completed_at", null),
    supabase
      .from("republish_queue")
      .select("*", { count: "exact", head: true })
      .is("completed_at", null),
    supabase.rpc("admin_company_overview", { p_from: fromIso, p_to: toIso }),
    supabase.rpc("listings_by_creator_contact", {
      p_from: fromIso,
      p_to: toIso,
      p_limit: 12,
    }),
    supabase.rpc("dashboard_inventory_breakdowns", { p_city_limit: 11 }),
    supabase.rpc("admin_dashboard_details", { p_from: fromIso, p_to: toIso }),
    loadFormOptions(),
  ]);

  const errors = [
    kpiRes.error,
    countsRes.error,
    dayRes.error,
    creatorRes.error,
    eventsRes.error,
    socialRes.error,
    republishRes.error,
    overviewRes.error,
    agentRes.error,
    breakdownRes.error,
    detailsRes.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((e) => e!.message).join("; "));
  }

  const kpiRow = Array.isArray(kpiRes.data) ? kpiRes.data[0] : kpiRes.data;
  const inventoryRows = (countsRes.data ?? []) as Array<{
    status: string;
    property_type: string;
    cnt: number | string;
  }>;

  const statusMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  for (const row of inventoryRows) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + num(row.cnt));
    typeMap.set(
      row.property_type,
      (typeMap.get(row.property_type) ?? 0) + num(row.cnt),
    );
  }

  const eventMap = new Map<string, number>();
  for (const row of (eventsRes.data ?? []) as Array<{
    action: string;
    cnt: number | string;
  }>) {
    eventMap.set(row.action, num(row.cnt));
  }

  // Fill missing days with 0 so the chart is continuous
  const dayMap = new Map<string, number>();
  for (const row of (dayRes.data ?? []) as Array<{
    day: string;
    cnt: number | string;
  }>) {
    const key = String(row.day).slice(0, 10);
    dayMap.set(key, num(row.cnt));
  }
  const byDay: DayCount[] = [];
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(to.getTime() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    byDay.push({ day: key, count: dayMap.get(key) ?? 0 });
  }

  const breakdown = (breakdownRes.data ?? {}) as {
    opportunity?: { name: string; value: number }[];
    active_cities?: { name: string; value: number }[];
  };
  const toNamed = (rows?: { name: string; value: number }[]) =>
    (rows ?? []).map((r) => ({ name: String(r.name), value: num(r.value) }));
  const allCities = toNamed(breakdown.active_cities);
  const isCatchAll = (name: string) => /^(other|unspecified)$/i.test(name.trim());

  const ov = (overviewRes.data ?? {}) as Record<string, unknown>;
  const overview = Object.fromEntries(
    (
      [
        "properties_added",
        "published_by_social",
        "republished",
        "closed",
        "dropped",
        "lost",
        "publish_on_social",
        "republish_on_social",
        "drop_to_update_social",
        "lost_to_update_social",
        "publish_pending_approval",
        "republish_pending_approval",
      ] as const
    ).map((k) => [k, num(ov[k])]),
  ) as CompanyOverview;

  return {
    period,
    rangeLabel: periodLabel(period, from),
    fromIso,
    toIso,
    overview,
    byAgent: (
      (agentRes.data ?? []) as Array<{
        created_by_name: string;
        total: number | string;
        direct: number | string;
        partner: number | string;
      }>
    ).map((r) => ({
      name: r.created_by_name,
      total: num(r.total),
      direct: num(r.direct),
      partner: num(r.partner),
    })),
    kpis: {
      total: num(kpiRow?.total),
      active: num(kpiRow?.active),
      added30d: num(kpiRow?.added_30d),
      socialOpen: socialRes.count ?? 0,
      republishOpen: republishRes.count ?? 0,
      dropped: eventMap.get("Drop") ?? 0,
      lost: eventMap.get("Lost") ?? 0,
      closed: eventMap.get("Closed") ?? 0,
      republishEvents: eventMap.get("Republish") ?? 0,
    },
    byStatus: [...statusMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    byType: [...typeMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    statusByType: inventoryRows.map((r) => ({
      type: r.property_type,
      status: r.status,
      value: num(r.cnt),
    })),
    byOpportunity: toNamed(breakdown.opportunity),
    activeCities: allCities.filter((c) => !isCatchAll(c.name)).slice(0, 10),
    activeCitiesOther: allCities
      .filter((c) => isCatchAll(c.name))
      .reduce((s, c) => s + c.value, 0),
    byDay,
    byCreator: (
      (creatorRes.data ?? []) as Array<{
        created_by_name: string;
        cnt: number | string;
      }>
    ).map((r) => ({ name: r.created_by_name, value: num(r.cnt) })),
    details: buildDetails((detailsRes.data ?? {}) as DetailsRaw, options, to),
  };
}
