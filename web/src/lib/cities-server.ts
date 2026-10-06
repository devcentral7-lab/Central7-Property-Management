import { CITIES_SETTING_KEY, LEGACY_CITIES, cleanCityName, sortCities } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";

export async function loadCities(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CITIES_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error("loadCities", error.message);
    return sortCities(LEGACY_CITIES);
  }
  if (!Array.isArray(data?.value)) return sortCities(LEGACY_CITIES);
  return sortCities(
    (data.value as unknown[]).map((v) => cleanCityName(String(v ?? ""))).filter(Boolean),
  );
}
