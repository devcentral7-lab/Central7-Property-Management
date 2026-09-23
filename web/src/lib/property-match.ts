import type { ExtractedPropertyFields } from "@/lib/gemini/extract-property";

export type MatchableProperty = {
  id: string;
  ref_no: string;
  created_at: string;
  created_by_name: string | null;
  opportunity_type: string | null;
  property_type: string | null;
  property_subtype: string | null;
  city: string | null;
  address: string | null;
  status: string | null;
  currency: string | null;
  price_total: number | null;
  budget: number | null;
  land_size_perch: number | null;
  floor_area_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  number_of_floors: number | null;
  parking_spaces: number | null;
  age_years: number | null;
  purpose: string | null;
  view: string | null;
  furnished: string | null;
  contact_type: string | null;
  contact_name: string | null;
  amenities: string[] | null;
  comments: string | null;
};

export type ScoredProperty = MatchableProperty & {
  match_percent: number;
  match_hits: string[];
};

function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function near(a: number | null, b: number | null, tol = 0.2): boolean {
  if (a == null || b == null) return false;
  if (a === 0 && b === 0) return true;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base <= tol;
}

function eqText(a: unknown, b: unknown): boolean {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && x === y);
}

function containsText(hay: unknown, needle: unknown): boolean {
  const h = norm(hay);
  const n = norm(needle);
  return Boolean(h && n && h.includes(n));
}

type Criterion = {
  key: string;
  weight: number;
  hit: boolean;
  label: string;
};

/** Score a property against extracted paragraph criteria (0–100). */
export function scorePropertyMatch(
  property: MatchableProperty,
  criteria: Record<string, string>,
): ScoredProperty {
  const c = criteria;
  const checks: Criterion[] = [];

  const addEnum = (
    key: string,
    propVal: unknown,
    weight: number,
    label: string,
  ) => {
    if (!c[key]) return;
    checks.push({
      key,
      weight,
      hit: eqText(propVal, c[key]),
      label,
    });
  };

  const addNear = (
    key: string,
    propVal: number | null,
    weight: number,
    label: string,
    tol = 0.2,
  ) => {
    if (!c[key]) return;
    const want = num(c[key]);
    checks.push({
      key,
      weight,
      hit: near(propVal, want, tol),
      label,
    });
  };

  const addContains = (
    key: string,
    propVal: unknown,
    weight: number,
    label: string,
  ) => {
    if (!c[key]) return;
    checks.push({
      key,
      weight,
      hit: containsText(propVal, c[key]) || containsText(c[key], propVal),
      label,
    });
  };

  addEnum("property_type", property.property_type, 3, "type");
  addEnum("opportunity_type", property.opportunity_type, 2.5, "opportunity");
  addEnum("city", property.city, 3, "city");
  addEnum("furnished", property.furnished, 1.5, "furnished");
  addEnum("currency", property.currency, 1, "currency");
  addEnum("contact_type", property.contact_type, 1, "contact type");
  addContains("property_subtype", property.property_subtype, 1.5, "subtype");
  addContains("purpose", property.purpose, 1.5, "purpose");
  addContains("view", property.view, 1.2, "view");
  addContains("address", property.address, 1.5, "address");
  addContains("contact_name", property.contact_name, 1, "contact");
  addNear("bedrooms", property.bedrooms, 2, "beds", 0.15);
  addNear("bathrooms", property.bathrooms, 2, "baths", 0.15);
  addNear("land_size_perch", property.land_size_perch, 2, "land", 0.2);
  addNear("floor_area_sqft", property.floor_area_sqft, 2, "floor area", 0.2);
  addNear("price_total", property.price_total, 2.5, "price", 0.25);
  addNear("budget", property.budget, 1.5, "budget", 0.25);
  addNear("parking_spaces", property.parking_spaces, 1, "parking", 0.2);
  addNear("number_of_floors", property.number_of_floors, 1, "floors", 0.2);
  addNear("age_years", property.age_years, 1, "age", 0.3);

  if (c.amenities) {
    const wanted = c.amenities
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    const have = (property.amenities ?? []).map((a) => a.toLowerCase());
    if (wanted.length) {
      const hits = wanted.filter((w) =>
        have.some((h) => h.includes(w) || w.includes(h)),
      ).length;
      checks.push({
        key: "amenities",
        weight: 2,
        hit: hits / wanted.length >= 0.4,
        label: `amenities ${hits}/${wanted.length}`,
      });
    }
  }

  if (c.comments) {
    const blob = [
      property.comments,
      property.address,
      property.purpose,
      property.view,
      ...(property.amenities ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const tokens = c.comments
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 3)
      .slice(0, 12);
    if (tokens.length) {
      const hits = tokens.filter((t) => blob.includes(t)).length;
      checks.push({
        key: "notes",
        weight: 1.5,
        hit: hits / tokens.length >= 0.3,
        label: "notes",
      });
    }
  }

  const totalWeight = checks.reduce((s, x) => s + x.weight, 0);
  if (!totalWeight) {
    return { ...property, match_percent: 0, match_hits: [] };
  }
  const hitWeight = checks
    .filter((x) => x.hit)
    .reduce((s, x) => s + x.weight, 0);
  const match_percent = Math.round((hitWeight / totalWeight) * 100);
  return {
    ...property,
    match_percent,
    match_hits: checks.filter((x) => x.hit).map((x) => x.label),
  };
}

export function extractedToCriteria(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v?.trim()) out[k] = v.trim();
  }
  return out;
}

/** Soft DB filters from extracted criteria to shrink the candidate set. */
export function softFiltersFromCriteria(criteria: Record<string, string>) {
  return {
    property_type: criteria.property_type || null,
    opportunity_type: criteria.opportunity_type || null,
    city: criteria.city || null,
    status: "Active" as string | null,
  };
}

export type { ExtractedPropertyFields };
