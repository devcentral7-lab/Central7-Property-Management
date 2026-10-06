"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CITIES_SETTING_KEY, cityKey, cleanCityName, sortCities } from "@/lib/cities";
import { loadCities } from "@/lib/cities-server";
import { createClient } from "@/lib/supabase/server";

export type CityTypeCount = { name: string; count: number };

export type CityStatsRow = {
  name: string;
  inList: boolean;
  total: number;
  active: number;
  sell: number;
  rent: number;
  types: CityTypeCount[];
};

export type CityStats = {
  rows: CityStatsRow[];
  listCount: number;
  totalListings: number;
  noCity: number;
};

type Result = { ok: true } | { ok: false; error: string };

const PAGE = 1000;
const MAX_NAME = 60;

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") throw new Error("Admin only");
  return profile;
}

async function saveCities(list: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: CITIES_SETTING_KEY, value: sortCities(list), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/app", "layout");
}

export async function addCity(raw: string): Promise<Result> {
  try {
    await requireAdmin();
    const name = cleanCityName(raw);
    if (!name) return { ok: false, error: "Enter a city name." };
    if (name.length > MAX_NAME) return { ok: false, error: `City names can be at most ${MAX_NAME} characters.` };
    const cities = await loadCities();
    const existing = cities.find((c) => cityKey(c) === cityKey(name));
    if (existing) return { ok: false, error: `${existing} is already on the list.` };

    await saveCities([...cities, name]);
    await logAudit({
      category: "settings",
      action: "city_add",
      subjectType: "city",
      subjectId: name,
      subjectLabel: name,
      summary: `Added city ${name}`,
      details: { city_count: cities.length + 1 },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function removeCity(raw: string): Promise<Result> {
  try {
    await requireAdmin();
    const cities = await loadCities();
    const target = cities.find((c) => cityKey(c) === cityKey(raw));
    if (!target) return { ok: false, error: "That city is not on the list." };

    const rest = cities.filter((c) => c !== target);
    await saveCities(rest);
    await logAudit({
      category: "settings",
      action: "city_remove",
      subjectType: "city",
      subjectId: target,
      subjectLabel: target,
      summary: `Removed city ${target}`,
      details: { city_count: rest.length },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

type Bucket = CityStatsRow & { typeCounts: Map<string, number> };

/** Listing counts per city. Cities on the list appear even with no listings; other city names are flagged. */
export async function loadCityStats(): Promise<CityStats> {
  await requireAdmin();
  const supabase = await createClient();
  const cities = await loadCities();

  const buckets = new Map<string, Bucket>();
  const bucket = (name: string, inList: boolean) => {
    const key = cityKey(name);
    let b = buckets.get(key);
    if (!b) {
      b = { name, inList, total: 0, active: 0, sell: 0, rent: 0, types: [], typeCounts: new Map() };
      buckets.set(key, b);
    }
    return b;
  };
  for (const c of cities) bucket(c, true);

  const { count, error: countErr } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(countErr.message);
  const pages = await Promise.all(
    Array.from({ length: Math.ceil((count ?? 0) / PAGE) }, async (_, i) => {
      const { data, error } = await supabase
        .from("properties")
        .select("city, status, opportunity_type, property_type")
        .order("id")
        .range(i * PAGE, i * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

  let totalListings = 0;
  let noCity = 0;
  for (const p of pages.flat()) {
    totalListings += 1;
    const city = cleanCityName(String(p.city ?? ""));
    if (!city) {
      noCity += 1;
      continue;
    }
    const b = bucket(city, false);
    b.total += 1;
    if (p.status === "Active") b.active += 1;
    if (p.opportunity_type === "Sell") b.sell += 1;
    else if (String(p.opportunity_type ?? "").startsWith("Rent")) b.rent += 1;
    const type = String(p.property_type ?? "").trim();
    if (type) b.typeCounts.set(type, (b.typeCounts.get(type) ?? 0) + 1);
  }

  const rows = [...buckets.values()].map(({ typeCounts, ...row }) => ({
    ...row,
    types: [...typeCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }));
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { rows, listCount: cities.length, totalListings, noCity };
}
