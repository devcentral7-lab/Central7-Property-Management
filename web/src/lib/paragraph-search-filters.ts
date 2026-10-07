import type { SearchFilterValues } from "@/app/app/properties/property-search-form";

export const SEARCH_RANGE_KEYS = [
  "bedrooms_min", "bedrooms_max", "bathrooms_min", "bathrooms_max",
  "land_min", "land_max", "floor_min", "floor_max",
  "price_min", "price_max", "budget_min", "budget_max", "parking_min",
] as const;

const RANGE_PAIRS = [
  ["bedrooms", "bedrooms_min", "bedrooms_max"],
  ["bathrooms", "bathrooms_min", "bathrooms_max"],
  ["land_size_perch", "land_min", "land_max"],
  ["floor_area_sqft", "floor_min", "floor_max"],
] as const;

/** Map extracted description fields to the same filters used by the results table. */
export function paragraphFieldsToFilters(fields: Record<string, string>): Partial<SearchFilterValues> {
  const filters: Partial<SearchFilterValues> = {};
  for (const key of ["property_type", "opportunity_type", "contact_type", "city", "complex", "furnished", "currency", "view", "status"] as const) {
    if (fields[key]?.trim()) filters[key] = fields[key].trim();
  }
  const numeric = (value: string | undefined) => {
    const text = value?.replace(/,/g, "").trim();
    if (!text || !Number.isFinite(Number(text)) || Number(text) < 0) return undefined;
    return String(Number(text));
  };
  for (const key of SEARCH_RANGE_KEYS) {
    const value = numeric(fields[key]);
    if (value !== undefined) filters[key] = value;
  }
  for (const [field, min, max] of RANGE_PAIRS) {
    const value = numeric(fields[field]);
    if (value !== undefined && filters[min] === undefined && filters[max] === undefined) {
      filters[min] = value;
      filters[max] = value;
    }
  }

  // Listings are only offered (Sell / Rent Out), so a searcher's budget or a single
  // quoted price is the most they'll pay.
  if (filters.price_min === undefined && filters.price_max === undefined) {
    if (filters.budget_min !== undefined) filters.price_min = filters.budget_min;
    if (filters.budget_max !== undefined) filters.price_max = filters.budget_max;
    if (filters.price_min === undefined && filters.price_max === undefined) {
      const single = numeric(fields.budget) ?? numeric(fields.price_total);
      if (single !== undefined) filters.price_max = single;
    }
  }
  delete filters.budget_min;
  delete filters.budget_max;

  for (const [min, max] of [...RANGE_PAIRS.map(([, a, b]) => [a, b] as const), ["price_min", "price_max"] as const]) {
    if (filters[min] !== undefined && filters[max] !== undefined && Number(filters[min]) > Number(filters[max])) {
      [filters[min], filters[max]] = [filters[max], filters[min]];
    }
  }

  // Gemini often assumes LKR; only filter by currency when an amount was given.
  if (filters.price_min === undefined && filters.price_max === undefined) delete filters.currency;

  if (filters.parking_min === undefined) {
    const parking = numeric(fields.parking_spaces);
    if (parking !== undefined) filters.parking_min = parking;
  }
  return filters;
}
