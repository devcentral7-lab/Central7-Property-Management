import {
  COLOMBO_OFFSET_MS,
  colomboYear,
  type DashboardRange,
} from "@/lib/dashboard-period";
import type { SocialDailyRow } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

const MAX_TREND_DAYS = 400;

export type SocialManagerDashboard = {
  rangeLabel: string;
  period: DashboardRange["period"];
  year: number;
  currentYear: number;
  firstYear: number;
  socialDaily: SocialDailyRow[];
  socialUnit: "day" | "month";
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

function buildSocialRows(raw: {
  social_done?: { day: string; action: string; value: number | string }[];
  social_backlog?: { day: string; publish: number | string; republish: number | string }[];
}): { socialDaily: SocialDailyRow[]; socialUnit: "day" | "month" } {
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
  return {
    socialDaily: socialMonthly ? groupSocialByMonth(socialDaily) : socialDaily,
    socialUnit: socialMonthly ? "month" : "day",
  };
}

/** Social Media Manager home: queue activity for the selected period only. */
export async function loadSocialManagerDashboard(
  range: DashboardRange,
): Promise<SocialManagerDashboard> {
  const supabase = await createClient();
  const now = new Date();
  const currentYear = colomboYear(now);

  const { data: firstDone } = await supabase
    .from("social_media_queue")
    .select("completed_at")
    .not("completed_at", "is", null)
    .order("completed_at")
    .limit(1)
    .maybeSingle();
  const { data: firstApproved } = await supabase
    .from("social_media_queue")
    .select("approved_at")
    .not("approved_at", "is", null)
    .order("approved_at")
    .limit(1)
    .maybeSingle();

  const stamps = [firstDone?.completed_at, firstApproved?.approved_at]
    .filter(Boolean)
    .map((s) => new Date(s as string));
  const first = stamps.length ? new Date(Math.min(...stamps.map((d) => d.getTime()))) : now;
  const { from, to } = periodBounds(range, now, first);

  const { data, error } = await supabase.rpc("social_media_dashboard_details", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;

  const built = buildSocialRows((data ?? {}) as Parameters<typeof buildSocialRows>[0]);

  return {
    rangeLabel: periodLabel(range, now),
    period: range.period,
    year: range.year,
    currentYear,
    firstYear: colomboYear(first),
    ...built,
  };
}
