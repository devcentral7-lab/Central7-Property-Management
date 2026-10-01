/** Filters for "My properties" — shared by the list page and the Excel export so both match. */

export type MinePropertyFilters = {
  q: string;
  status: string;
  opportunity_type: string;
  property_type: string;
  currency: string;
  city: string;
  bedrooms_min: string;
  price_min: string;
  price_max: string;
  added_from: string;
  added_to: string;
};

export const MINE_FILTER_KEYS = [
  "q",
  "status",
  "opportunity_type",
  "property_type",
  "currency",
  "city",
  "bedrooms_min",
  "price_min",
  "price_max",
  "added_from",
  "added_to",
] as const satisfies readonly (keyof MinePropertyFilters)[];

type Params = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOMBO_OFFSET = "+05:30";
const DAY_MS = 24 * 60 * 60 * 1000;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();
}

function numOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Start of a `YYYY-MM-DD` day in Sri Lanka time, as an ISO timestamp. */
function dayStartIso(day: string, addDays = 0): string | null {
  if (!DATE_RE.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00${COLOMBO_OFFSET}`);
  return Number.isNaN(t) ? null : new Date(t + addDays * DAY_MS).toISOString();
}

export function mineFiltersFromParams(sp: Params): MinePropertyFilters {
  return Object.fromEntries(
    MINE_FILTER_KEYS.map((k) => [k, one(sp[k])]),
  ) as MinePropertyFilters;
}

export function hasMineFilters(f: MinePropertyFilters): boolean {
  return MINE_FILTER_KEYS.some((k) => Boolean(f[k]));
}

/** Sets every non-empty filter on `params`. */
export function appendMineFilters(params: URLSearchParams, f: MinePropertyFilters) {
  for (const k of MINE_FILTER_KEYS) {
    if (f[k]) params.set(k, f[k]);
  }
}

const FILTER_LABELS: Record<keyof MinePropertyFilters, string> = {
  q: "Search",
  status: "Status",
  opportunity_type: "Opportunity",
  property_type: "Type",
  currency: "Currency",
  city: "City",
  bedrooms_min: "Beds min",
  price_min: "Price min",
  price_max: "Price max",
  added_from: "Added from",
  added_to: "Added to",
};

/** e.g. `Status: Active · City: Colombo`, or "" when unfiltered. */
export function describeMineFilters(f: MinePropertyFilters): string {
  return MINE_FILTER_KEYS.filter((k) => f[k])
    .map((k) => `${FILTER_LABELS[k]}: ${f[k]}`)
    .join(" · ");
}

type Filterable<Q> = {
  eq(column: string, value: string): Q;
  ilike(column: string, pattern: string): Q;
  gte(column: string, value: number | string): Q;
  lte(column: string, value: number | string): Q;
  lt(column: string, value: string): Q;
  or(filters: string): Q;
};

/** Works on `properties` and `property_list_cards` (same column names). */
export function applyMineFilters<Q extends Filterable<Q>>(query: Q, f: MinePropertyFilters): Q {
  let q = query;
  if (f.status) q = q.eq("status", f.status);
  if (f.opportunity_type) q = q.eq("opportunity_type", f.opportunity_type);
  if (f.property_type) q = q.eq("property_type", f.property_type);
  if (f.currency) q = q.eq("currency", f.currency);
  if (f.city) q = q.ilike("city", `%${f.city}%`);

  const bedroomsMin = numOrNull(f.bedrooms_min);
  const priceMin = numOrNull(f.price_min);
  const priceMax = numOrNull(f.price_max);
  if (bedroomsMin != null) q = q.gte("bedrooms", bedroomsMin);
  if (priceMin != null) q = q.gte("price_total", priceMin);
  if (priceMax != null) q = q.lte("price_total", priceMax);

  const from = dayStartIso(f.added_from);
  const toExclusive = dayStartIso(f.added_to, 1);
  if (from) q = q.gte("created_at", from);
  if (toExclusive) q = q.lt("created_at", toExclusive);

  if (f.q) {
    const term = f.q.replace(/[%_,()]/g, " ").trim();
    if (term) {
      q = q.or(
        `ref_no.ilike.%${term}%,contact_name.ilike.%${term}%,contact_phone_1.ilike.%${term}%,address.ilike.%${term}%,city.ilike.%${term}%`,
      );
    }
  }
  return q;
}
