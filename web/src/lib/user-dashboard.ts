import { OPPORTUNITY_TYPES, PROPERTY_TYPES } from "@/lib/constants";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCard } from "@/lib/types";

const TZ_OFFSET_MINUTES = 330; // Asia/Colombo, no DST

export type CountRow = { name: string; count: number };

export type UserDashboardData = {
  total: number;
  active: number;
  addedThisMonth: number;
  addedLast30: number;
  byStatus: CountRow[];
  byType: CountRow[];
  byOpportunity: CountRow[];
  recent: PropertyCard[];
  activity: {
    id: string;
    ref_no: string;
    action: string;
    comment: string | null;
    occurred_at: string;
  }[];
};

/** Start of the current month in Colombo, as a UTC ISO string. */
function colomboMonthStart(now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return new Date(startLocal - TZ_OFFSET_MINUTES * 60_000).toISOString();
}

/** Everything on the User dashboard, scoped to listings created by this staff member. */
export async function loadUserDashboard(displayName: string): Promise<UserDashboardData> {
  const supabase = await createClient();
  const options = await loadFormOptions();
  const statuses = options.statuses.length ? options.statuses : ["Active"];
  const types = options.propertyTypes.length ? options.propertyTypes : [...PROPERTY_TYPES];
  const opportunities = options.opportunityTypes.length
    ? options.opportunityTypes
    : [...OPPORTUNITY_TYPES];

  const mine = () =>
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("created_by_name", displayName);

  const countOf = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

  const [total, addedThisMonth, addedLast30, statusCounts, typeCounts, oppCounts, recentRes, activityRes] =
    await Promise.all([
      countOf(mine()),
      countOf(mine().gte("created_at", colomboMonthStart())),
      countOf(mine().gte("created_at", since30)),
      Promise.all(statuses.map((s) => countOf(mine().eq("status", s)))),
      Promise.all(types.map((t) => countOf(mine().eq("property_type", t)))),
      Promise.all(opportunities.map((o) => countOf(mine().eq("opportunity_type", o)))),
      supabase
        .from("property_list_cards")
        .select("*")
        .eq("created_by_name", displayName)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("property_status_events")
        .select("id, ref_no, action, comment, occurred_at")
        .eq("actor_name", displayName)
        .is("archived_at", null)
        .order("occurred_at", { ascending: false })
        .limit(8),
    ]);

  if (recentRes.error) throw new Error(recentRes.error.message);
  if (activityRes.error) throw new Error(activityRes.error.message);

  const rows = (names: string[], counts: number[]) =>
    names.map((name, i) => ({ name, count: counts[i] })).filter((r) => r.count > 0);

  const byStatus = rows(statuses, statusCounts);

  return {
    total,
    active: byStatus.find((r) => r.name === "Active")?.count ?? 0,
    addedThisMonth,
    addedLast30,
    byStatus,
    byType: rows(types, typeCounts).sort((a, b) => b.count - a.count),
    byOpportunity: rows(opportunities, oppCounts),
    recent: (recentRes.data ?? []) as PropertyCard[],
    activity: (activityRes.data ?? []).map((e) => ({
      id: String(e.id),
      ref_no: String(e.ref_no),
      action: String(e.action),
      comment: e.comment,
      occurred_at: String(e.occurred_at),
    })),
  };
}
