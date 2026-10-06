import {
  COLOMBO_OFFSET_MS,
  colomboYear,
  type DashboardPeriod,
  type DashboardRange,
} from "@/lib/dashboard-period";
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
  /** Long ranges group socialDaily by month (day = first of the month, remaining = month end). */
  socialUnit: "day" | "month";
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
  year: number;
  currentYear: number;
  firstYear: number;
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
  /** byDay, or monthly totals (day = first of the month) when the range is too long to chart per day. */
  trend: DayCount[];
  trendUnit: "day" | "month";
  byCreator: NamedCount[];
  details: AdminDetails;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000;
/** Longer ranges chart listings added per month instead of per day. */
const MAX_TREND_DAYS = 400;

function colomboMidnight(y: number, m: number, d = 1): Date {
  return new Date(Date.UTC(y, m, d) - COLOMBO_OFFSET_MS);
}

function periodBounds(range: DashboardRange, now: Date, first: Date): { from: Date; to: Date } {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  if (range.period === "all") return { from: first < now ? first : now, to: now };
  if (range.period === "month") {
    return { from: colomboMidnight(local.getUTCFullYear(), local.getUTCMonth()), to: now };
  }
  const from = colomboMidnight(range.year, 0);
  const end = colomboMidnight(range.year + 1, 0);
  return { from, to: end < now ? end : now };
}

function periodLabel(range: DashboardRange, now: Date): string {
  if (range.period === "all") return "All time";
  if (range.period === "year") return String(range.year);
  return new Date(now.getTime() + COLOMBO_OFFSET_MS).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function localDayKey(t: number): string {
  return new Date(t + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}

/** Per-agent monthly counts for a past year, and daily counts for its December. */
async function pastYearAgentBuckets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: Date,
  to: Date,
): Promise<Pick<DetailsRaw, "monthly_by_agent" | "daily_by_agent">> {
  const monthly = new Map<string, number>();
  const daily = new Map<string, number>();
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from("properties")
      .select("created_at, created_by_name")
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .order("id")
      .range(start, start + PAGE - 1);
    if (error) throw error;
    for (const p of data ?? []) {
      const key = localDayKey(Date.parse(p.created_at as string));
      const agent = String(p.created_by_name ?? "").trim() || "(Unassigned)";
      const month = `${key.slice(0, 7)}\u0000${agent}`;
      monthly.set(month, (monthly.get(month) ?? 0) + 1);
      if (key.slice(5, 7) === "12") {
        const day = `${key.slice(8, 10)}\u0000${agent}`;
        daily.set(day, (daily.get(day) ?? 0) + 1);
      }
    }
    if (!data || data.length < PAGE) break;
  }
  const rows = (m: Map<string, number>): BucketRow[] =>
    [...m.entries()].map(([k, value]) => {
      const [bucket, agent] = k.split("\u0000");
      return { bucket, agent, value };
    });
  return { monthly_by_agent: rows(monthly), daily_by_agent: rows(daily) };
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
  const socialMonthly = socialDaily.length > MAX_TREND_DAYS;
  const social = socialMonthly ? groupSocialByMonth(socialDaily) : socialDaily;

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
    socialDaily: social,
    socialUnit: socialMonthly ? "month" : "day",
  };
}

function groupSocialByMonth(rows: SocialDailyRow[]): SocialDailyRow[] {
  const months = new Map<string, SocialDailyRow>();
  for (const r of rows) {
    const day = `${r.day.slice(0, 7)}-01`;
    const m = months.get(day);
    if (!m) {
      months.set(day, { ...r, day });
      continue;
    }
    m.published += r.published;
    m.republished += r.republished;
    m.drop += r.drop;
    m.lost += r.lost;
    m.hold += r.hold;
    m.closed += r.closed;
    m.dataChange += r.dataChange;
    m.remainingPublish = r.remainingPublish;
    m.remainingRepublish = r.remainingRepublish;
  }
  return [...months.values()];
}

/**
 * Admin home metrics from aggregate RPCs. The only row download is created_at and
 * agent for a past year's by-agent tables, which the details RPC only builds for the current year.
 */
export async function loadAdminAnalytics(range: DashboardRange): Promise<AdminAnalytics> {
  const supabase = await createClient();
  const now = new Date();
  const currentYear = colomboYear(now);
  const { data: firstRow, error: firstErr } = await supabase
    .from("properties")
    .select("created_at")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (firstErr) throw firstErr;
  const first = firstRow?.created_at ? new Date(firstRow.created_at as string) : now;
  const { from, to } = periodBounds(range, now, first);
  const pastYear = range.period === "year" && range.year < currentYear;
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
    pastYearBuckets,
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
    pastYear ? pastYearAgentBuckets(supabase, from, to) : null,
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
  const lastDay = localDayKey(to.getTime() - 1);
  for (let t = Date.parse(localDayKey(from.getTime())); ; t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    byDay.push({ day: key, count: dayMap.get(key) ?? 0 });
    if (key >= lastDay) break;
  }
  const monthly = byDay.length > MAX_TREND_DAYS;
  const trend = monthly
    ? [...byDay.reduce((m, d) => {
        const key = `${d.day.slice(0, 7)}-01`;
        return m.set(key, (m.get(key) ?? 0) + d.count);
      }, new Map<string, number>())].map(([day, count]) => ({ day, count }))
    : byDay;

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
    period: range.period,
    year: range.year,
    currentYear,
    firstYear: Math.min(colomboYear(first), currentYear),
    rangeLabel: periodLabel(range, now),
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
    trend,
    trendUnit: monthly ? "month" : "day",
    byCreator: (
      (creatorRes.data ?? []) as Array<{
        created_by_name: string;
        cnt: number | string;
      }>
    ).map((r) => ({ name: r.created_by_name, value: num(r.cnt) })),
    details: buildDetails(
      { ...((detailsRes.data ?? {}) as DetailsRaw), ...pastYearBuckets },
      options,
      pastYear ? new Date(to.getTime() - 1) : now,
    ),
  };
}
