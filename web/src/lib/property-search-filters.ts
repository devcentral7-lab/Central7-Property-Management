/** Filters for property search — shared by the list page and Excel export so both match. */

import { cityLikePattern } from "@/lib/cities";
import { splitListParam } from "@/lib/list-param";

export type SearchFilterValues = {
  q: string;
  status: string;
  opportunity_type: string;
  property_type: string;
  property_subtype: string;
  complex: string;
  added_by: string;
  contact: string;
  contact_type: string;
  phone: string;
  city: string;
  furnished: string;
  currency: string;
  view: string;
  bedrooms_min: string;
  bedrooms_max: string;
  bathrooms_min: string;
  bathrooms_max: string;
  land_min: string;
  land_max: string;
  floor_min: string;
  floor_max: string;
  price_min: string;
  price_max: string;
  budget_min: string;
  budget_max: string;
  parking_min: string;
  do_not_publish: string;
  social: string;
  advanced: string;
};

export const SEARCH_FILTER_KEYS = [
  "q",
  "status",
  "opportunity_type",
  "property_type",
  "property_subtype",
  "complex",
  "added_by",
  "contact",
  "contact_type",
  "phone",
  "city",
  "furnished",
  "currency",
  "view",
  "bedrooms_min",
  "bedrooms_max",
  "bathrooms_min",
  "bathrooms_max",
  "land_min",
  "land_max",
  "floor_min",
  "floor_max",
  "price_min",
  "price_max",
  "budget_min",
  "budget_max",
  "parking_min",
  "do_not_publish",
  "social",
  "advanced",
] as const satisfies readonly (keyof SearchFilterValues)[];

type Params = Record<string, string | string[] | undefined>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();
}

function numOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function searchFiltersFromParams(sp: Params): SearchFilterValues {
  return {
    q: one(sp.q),
    // No status param means a fresh search (default Active); an empty one means "All statuses".
    status: sp.status === undefined ? "Active" : one(sp.status),
    opportunity_type: one(sp.opportunity_type),
    property_type: one(sp.property_type),
    property_subtype: one(sp.property_subtype),
    complex: one(sp.complex),
    added_by: one(sp.added_by),
    contact: one(sp.contact),
    contact_type: one(sp.contact_type),
    phone: one(sp.phone),
    city: one(sp.city),
    furnished: one(sp.furnished),
    currency: one(sp.currency),
    view: one(sp.view),
    bedrooms_min: one(sp.bedrooms_min),
    bedrooms_max: one(sp.bedrooms_max),
    bathrooms_min: one(sp.bathrooms_min),
    bathrooms_max: one(sp.bathrooms_max),
    land_min: one(sp.land_min),
    land_max: one(sp.land_max),
    floor_min: one(sp.floor_min),
    floor_max: one(sp.floor_max),
    price_min: one(sp.price_min),
    price_max: one(sp.price_max),
    budget_min: one(sp.budget_min),
    budget_max: one(sp.budget_max),
    parking_min: one(sp.parking_min),
    do_not_publish: one(sp.do_not_publish),
    social: one(sp.social),
    advanced: one(sp.advanced),
  };
}

/** True when any filter other than UI-only `advanced` is set. */
export function hasSearchFilters(f: SearchFilterValues): boolean {
  return SEARCH_FILTER_KEYS.some((k) => k !== "advanced" && Boolean(f[k]));
}

/** Sets non-empty filters and preserves an explicit "All statuses" selection. */
export function appendSearchFilters(params: URLSearchParams, f: SearchFilterValues) {
  for (const k of SEARCH_FILTER_KEYS) {
    if (k === "advanced") continue;
    if (f[k] || k === "status") params.set(k, f[k]);
  }
}

const FILTER_LABELS: Partial<Record<keyof SearchFilterValues, string>> = {
  q: "Search",
  status: "Status",
  opportunity_type: "Opportunity",
  property_type: "Type",
  property_subtype: "Subtype",
  complex: "Complex",
  added_by: "Added by",
  contact: "Contact",
  contact_type: "Contact type",
  phone: "Phone",
  city: "City",
  furnished: "Furnished",
  currency: "Currency",
  view: "View",
  bedrooms_min: "Beds min",
  bedrooms_max: "Beds max",
  bathrooms_min: "Baths min",
  bathrooms_max: "Baths max",
  land_min: "Land min",
  land_max: "Land max",
  floor_min: "Floor min",
  floor_max: "Floor max",
  price_min: "Price min",
  price_max: "Price max",
  budget_min: "Budget min",
  budget_max: "Budget max",
  parking_min: "Parking min",
  do_not_publish: "Do not publish",
  social: "Social",
};

/** e.g. `Status: Active · City: Colombo 05`, or "" when unfiltered. */
export function describeSearchFilters(f: SearchFilterValues): string {
  return SEARCH_FILTER_KEYS.filter((k) => k !== "advanced" && f[k])
    .map((k) => `${FILTER_LABELS[k] ?? k}: ${f[k]}`)
    .join(" · ");
}

type Filterable<Q> = {
  eq(column: string, value: string | boolean): Q;
  neq(column: string, value: string): Q;
  ilike(column: string, pattern: string): Q;
  gte(column: string, value: number | string): Q;
  lte(column: string, value: number | string): Q;
  in(column: string, values: readonly string[]): Q;
  is(column: string, value: null): Q;
  not(column: string, operator: string, value: null): Q;
  or(filters: string): Q;
};

/** Same filter rules as the Search & Filter results table. */
export function applySearchFilters<Q extends Filterable<Q>>(query: Q, f: SearchFilterValues): Q {
  let q = query;
  if (f.status) q = q.eq("status", f.status);
  if (f.property_type) q = q.eq("property_type", f.property_type);
  if (f.property_type === "Commercial Property" && f.property_subtype) {
    q = q.eq("property_subtype", f.property_subtype);
  }
  const complexIds = splitListParam(f.complex);
  if (complexIds.length) {
    const valid = complexIds.filter((id) => UUID_RE.test(id));
    q = valid.length ? q.in("apartment_complex_id", valid) : q.is("id", null);
  }
  const creatorNames = splitListParam(f.added_by);
  if (creatorNames.length) q = q.in("created_by_name", creatorNames);
  if (f.contact) {
    q = q.ilike("contact_name", `%${f.contact.replace(/[%_]/g, " ")}%`);
  }
  if (f.phone) {
    const phone = f.phone.replace(/[%_,]/g, " ");
    q = q.or(`contact_phone_1.ilike.%${phone}%,contact_phone_2.ilike.%${phone}%`);
  }
  if (f.opportunity_type) q = q.eq("opportunity_type", f.opportunity_type);
  if (f.contact_type) q = q.eq("contact_type", f.contact_type);
  // Most older listings never recorded furnishing, so blanks count as a possible match.
  if (f.furnished) {
    q = q.or(`furnished.eq."${f.furnished.replace(/["\\]/g, "")}",furnished.is.null`);
  }
  if (f.currency) q = q.eq("currency", f.currency);
  const cityPatterns = splitListParam(f.city).map(cityLikePattern).filter(Boolean);
  if (cityPatterns.length === 1) {
    q = q.ilike("city", cityPatterns[0]);
  } else if (cityPatterns.length > 1) {
    q = q.or(cityPatterns.map((p) => `city.ilike."${p}"`).join(","));
  }
  if (f.view) q = q.ilike("view", `%${f.view}%`);
  if (f.do_not_publish === "true") q = q.eq("do_not_publish", true);
  else if (f.do_not_publish === "false") q = q.eq("do_not_publish", false);
  if (f.social === "pending") {
    q = q.not("social_pending", "is", null);
  } else if (f.social === "awaiting_approval" || f.social === "approved") {
    q = q.eq("social_pending", f.social);
  } else if (["published", "taken_down", "never"].includes(f.social)) {
    q = q.eq("social_state", f.social);
  }

  const bedroomsMin = numOrNull(f.bedrooms_min);
  const bedroomsMax = numOrNull(f.bedrooms_max);
  const bathroomsMin = numOrNull(f.bathrooms_min);
  const bathroomsMax = numOrNull(f.bathrooms_max);
  const landMin = numOrNull(f.land_min);
  const landMax = numOrNull(f.land_max);
  const floorMin = numOrNull(f.floor_min);
  const floorMax = numOrNull(f.floor_max);
  const priceMin = numOrNull(f.price_min);
  const priceMax = numOrNull(f.price_max);
  const budgetMin = numOrNull(f.budget_min);
  const budgetMax = numOrNull(f.budget_max);
  const parkingMin = numOrNull(f.parking_min);

  if (bedroomsMin != null) q = q.gte("bedrooms", bedroomsMin);
  if (bedroomsMax != null) q = q.lte("bedrooms", bedroomsMax);
  if (bathroomsMin != null) q = q.gte("bathrooms", bathroomsMin);
  if (bathroomsMax != null) q = q.lte("bathrooms", bathroomsMax);
  if (landMin != null) q = q.gte("land_size_perch", landMin);
  if (landMax != null) q = q.lte("land_size_perch", landMax);
  if (floorMin != null) q = q.gte("floor_area_sqft", floorMin);
  if (floorMax != null) q = q.lte("floor_area_sqft", floorMax);
  if (priceMin != null) q = q.gte("price_total", priceMin);
  if (priceMax != null) q = q.lte("price_total", priceMax);
  if (budgetMin != null) q = q.gte("budget", budgetMin);
  if (budgetMax != null) q = q.lte("budget", budgetMax);
  if (parkingMin != null) q = q.gte("parking_spaces", parkingMin);

  if (f.q) {
    const term = f.q.replace(/[%_,]/g, " ");
    q = q.or(
      `ref_no.ilike.%${term}%,contact_name.ilike.%${term}%,address.ilike.%${term}%,city.ilike.%${term}%,contact_phone_1.ilike.%${term}%,comments.ilike.%${term}%,internal_comments.ilike.%${term}%`,
    );
  }
  return q;
}
