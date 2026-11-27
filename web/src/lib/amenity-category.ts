/** Unit / listing-level items shown as Features on PDFs. */
const DEFAULT_FEATURE_NAMES = new Set(
  [
    "Air Conditioning",
    "Balcony",
    "Maids Room",
    "Maids Toilet",
    "Sea View",
    "Garage",
    "Study Room",
    "Store Room",
    "Servant Quarters",
    "Lift/Elevator",
    "Water Tank",
    "Solar Panels",
    "Generator",
    "CCTV",
  ].map((n) => n.toLowerCase()),
);

export type AmenityCategory = "feature" | "amenity";

export type AmenityOption = {
  name: string;
  category: AmenityCategory;
};

export function defaultAmenityCategory(name: string): AmenityCategory {
  return DEFAULT_FEATURE_NAMES.has(name.trim().toLowerCase()) ? "feature" : "amenity";
}

export function parseAmenityCategory(raw: unknown): AmenityCategory {
  return raw === "feature" ? "feature" : "amenity";
}

/** Accept legacy string[] or `{ name, category }[]` from app_settings. */
export function parseAmenityOptions(value: unknown, fallbackNames: readonly string[]): AmenityOption[] {
  if (!Array.isArray(value) || !value.length) {
    return fallbackNames.map((name) => ({
      name,
      category: defaultAmenityCategory(name),
    }));
  }

  const out: AmenityOption[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    let name = "";
    let category: AmenityCategory = "amenity";
    if (typeof item === "string") {
      name = item.trim();
      category = defaultAmenityCategory(name);
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      name = String(row.name ?? "").trim();
      category =
        row.category != null
          ? parseAmenityCategory(row.category)
          : defaultAmenityCategory(name);
    }
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, category });
  }
  return out.length
    ? out
    : fallbackNames.map((name) => ({
        name,
        category: defaultAmenityCategory(name),
      }));
}

export function amenityCategoryLookup(
  options: AmenityOption[],
): Map<string, AmenityCategory> {
  return new Map(options.map((o) => [o.name.toLowerCase(), o.category]));
}

export function resolveAmenityCategory(
  name: string,
  lookup: Map<string, AmenityCategory>,
): AmenityCategory {
  return lookup.get(name.trim().toLowerCase()) ?? defaultAmenityCategory(name);
}
