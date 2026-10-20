import { citySpellingKey, cleanCityName, stripCountryFromCity } from "@/lib/cities";

export type PlaceSuggestion = {
  /** Short name suitable for `properties.city` (e.g. "Kandy"). */
  value: string;
  /** Longer label for the dropdown (e.g. "Kandy, Central Province"). */
  label: string;
};

type PlacesAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
  error?: { message?: string };
};

export function isPlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

/**
 * Google Places Autocomplete (New), hard-restricted to Sri Lanka.
 * Returns short locality-style names for the City field.
 */
export async function autocompleteSriLankaCities(
  input: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return [];

  const q = cleanCityName(input);
  if (q.length < 2) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["lk"],
      includedPrimaryTypes: [
        "locality",
        "sublocality",
        "administrative_area_level_3",
        "administrative_area_level_2",
      ],
      languageCode: "en",
    }),
  });

  const data = (await res.json()) as PlacesAutocompleteResponse;
  if (!res.ok) {
    const message = data.error?.message || `Places autocomplete failed (${res.status})`;
    throw new Error(message);
  }

  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const s of data.suggestions ?? []) {
    const pred = s.placePrediction;
    if (!pred) continue;
    const main = stripCountryFromCity(pred.structuredFormat?.mainText?.text ?? "");
    const secondary = stripCountryFromCity(pred.structuredFormat?.secondaryText?.text ?? "");
    const full = stripCountryFromCity(pred.text?.text ?? "");
    // Always store the short place name without ", Sri Lanka".
    const value =
      stripCountryFromCity(main) ||
      stripCountryFromCity(full.split(",")[0] ?? "") ||
      "";
    if (!value) continue;
    const keyName = citySpellingKey(value);
    if (!keyName || seen.has(keyName)) continue;
    seen.add(keyName);
    const region = secondary && citySpellingKey(secondary) !== keyName ? secondary : "";
    out.push({
      value,
      // Dropdown shows city only; region (without country) as hint when useful.
      label: region ? `${value} · ${region}` : value,
    });
  }
  return out;
}

/** Known names first, then Google results not already covered (by spelling key). */
export function mergeCitySuggestions(
  known: readonly string[],
  remote: readonly PlaceSuggestion[],
  query: string,
): { value: string; label: string; source: "known" | "google" }[] {
  const term = query.trim().toLowerCase();
  const local = (term
    ? known.filter((c) => c.toLowerCase().includes(term))
    : [...known]
  ).map((value) => ({ value, label: value, source: "known" as const }));

  const seen = new Set(local.map((c) => citySpellingKey(c.value)));
  const extra = remote
    .filter((r) => {
      const k = citySpellingKey(r.value);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((r) => ({ value: r.value, label: r.label, source: "google" as const }));

  return [...local, ...extra];
}
