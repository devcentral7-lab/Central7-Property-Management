import type { SearchFilterValues } from "@/app/app/properties/property-search-form";

export const SEARCH_RANGE_KEYS = [
  "bedrooms_min", "bedrooms_max", "bathrooms_min", "bathrooms_max",
  "land_min", "land_max", "floor_min", "floor_max",
  "price_min", "price_max", "budget_min", "budget_max", "parking_min",
] as const;

/** Map extracted description fields to the same filters used by the results table. */
export function paragraphFieldsToFilters(fields: Record<string, string>): Partial<SearchFilterValues> {
  const filters: Partial<SearchFilterValues> = {};
  for (const key of ["property_type", "opportunity_type", "contact_type", "city", "furnished", "currency", "view", "status"] as const) {
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
  for (const [field, min, max] of [
    ["bedrooms", "bedrooms_min", "bedrooms_max"],
    ["bathrooms", "bathrooms_min", "bathrooms_max"],
    ["land_size_perch", "land_min", "land_max"],
    ["floor_area_sqft", "floor_min", "floor_max"],
    ["price_total", "price_min", "price_max"],
  ] as const) {
    const value = numeric(fields[field]);
    if (value !== undefined && filters[min] === undefined && filters[max] === undefined) {
      filters[min] = value;
      filters[max] = value;
    }
    if (filters[min] !== undefined && filters[max] !== undefined && Number(filters[min]) > Number(filters[max])) {
      [filters[min], filters[max]] = [filters[max], filters[min]];
    }
  }
  if (filters.budget_min === undefined && filters.budget_max === undefined && filters.price_min === undefined && filters.price_max === undefined) {
    const budget = numeric(fields.budget);
    if (budget !== undefined) filters.price_max = budget;
  }
  if (filters.parking_min === undefined) {
    const parking = numeric(fields.parking_spaces);
    if (parking !== undefined) filters.parking_min = parking;
  }
  return filters;
}
