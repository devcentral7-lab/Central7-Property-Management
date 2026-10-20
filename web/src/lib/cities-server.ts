import {
  CITIES_SETTING_KEY,
  LEGACY_CITIES,
  cleanCityName,
  citySpellingKey,
  sortCities,
} from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000;

async function loadCuratedCities(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CITIES_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error("loadCities", error.message);
    return [...LEGACY_CITIES];
  }
  if (!Array.isArray(data?.value)) return [...LEGACY_CITIES];
  return (data.value as unknown[])
    .map((v) => cleanCityName(String(v ?? "")))
    .filter(Boolean);
}

/** Distinct city spellings already used on listings (paginated past PostgREST's row cap). */
async function loadUsedCities(): Promise<string[]> {
  const supabase = await createClient();
  const names: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("properties")
      .select("city")
      .not("city", "is", null)
      .neq("city", "")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("loadUsedCities", error.message);
      return names;
    }
    for (const row of data ?? []) {
      const city = cleanCityName(String(row.city ?? ""));
      if (city) names.push(city);
    }
    if (!data || data.length < PAGE) break;
  }
  return names;
}

/**
 * Curated cities plus distinct names already on properties.
 * Used as the "known" half of hybrid City suggestions (before Google Places).
 */
export async function loadCities(): Promise<string[]> {
  const [curated, used] = await Promise.all([loadCuratedCities(), loadUsedCities()]);
  const byKey = new Map<string, string>();
  for (const name of [...curated, ...used]) {
    const key = citySpellingKey(name);
    if (key && !byKey.has(key)) byKey.set(key, name);
  }
  return sortCities([...byKey.values()]);
}
