import { createClient } from "@/lib/supabase/server";

export type NamedCount = { name: string; value: number };
export type DayCount = { day: string; count: number };

export type AdminAnalytics = {
  rangeLabel: string;
  fromIso: string;
  toIso: string;
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
  byDay: DayCount[];
  byCreator: NamedCount[];
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Aggregate-only Admin home metrics — never downloads property rows. */
export async function loadAdminAnalytics(): Promise<AdminAnalytics> {
  const supabase = await createClient();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
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
      .is("completed_at", null),
    supabase
      .from("republish_queue")
      .select("*", { count: "exact", head: true })
      .is("completed_at", null),
  ]);

  const errors = [
    kpiRes.error,
    countsRes.error,
    dayRes.error,
    creatorRes.error,
    eventsRes.error,
    socialRes.error,
    republishRes.error,
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
  for (let i = 29; i >= 0; i--) {
    const d = new Date(to.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDay.push({ day: key, count: dayMap.get(key) ?? 0 });
  }

  return {
    rangeLabel: "Last 30 days",
    fromIso,
    toIso,
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
    byDay,
    byCreator: (
      (creatorRes.data ?? []) as Array<{
        created_by_name: string;
        cnt: number | string;
      }>
    ).map((r) => ({ name: r.created_by_name, value: num(r.cnt) })),
  };
}
