"use server";

import { requireProfile } from "@/lib/auth";
import { loadFormOptions } from "@/lib/form-options";
import {
  extractPropertyFieldsWithGemini,
  isGeminiConfigured,
} from "@/lib/gemini/extract-property";
import {
  extractedToCriteria,
  scorePropertyMatch,
  softFiltersFromCriteria,
  type MatchableProperty,
  type ScoredProperty,
} from "@/lib/property-match";
import { createClient } from "@/lib/supabase/server";

export type ParagraphSearchResult =
  | {
      ok: true;
      criteria: Record<string, string>;
      results: ScoredProperty[];
    }
  | { ok: false; error: string };

export type RefMatch = {
  ref_no: string;
  property_type: string | null;
  opportunity_type: string | null;
  city: string | null;
  status: string | null;
};

export async function searchRefNumbers(term: string): Promise<RefMatch[]> {
  await requireProfile();
  const q = term.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!q) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("ref_no, property_type, opportunity_type, city, status")
    .ilike("ref_no", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  const rank = (ref: string) => {
    const r = ref.toUpperCase();
    if (r === q || r.replace(/^C7-?/, "") === q) return 0;
    if (r.startsWith(q) || r.replace(/^C7-?/, "").startsWith(q)) return 1;
    return 2;
  };
  return ((data ?? []) as RefMatch[])
    .sort((a, b) => rank(a.ref_no) - rank(b.ref_no))
    .slice(0, 8);
}

const SELECT_COLS =
  "id, ref_no, created_at, created_by_name, opportunity_type, property_type, property_subtype, city, address, status, currency, price_total, budget, land_size_perch, floor_area_sqft, bedrooms, bathrooms, number_of_floors, parking_spaces, age_years, purpose, type_attributes, view, furnished, contact_type, contact_name, amenities, comments";

export async function searchPropertiesByParagraph(
  paragraph: string,
): Promise<ParagraphSearchResult> {
  try {
    await requireProfile();
  } catch {
    return { ok: false, error: "Sign in required." };
  }

  const text = paragraph.trim();
  if (text.length < 12) {
    return { ok: false, error: "Paste a longer property description." };
  }
  if (!isGeminiConfigured()) {
    return { ok: false, error: "Gemini API key is not configured." };
  }

  const options = await loadFormOptions();
  let fields: Record<string, string>;
  try {
    fields = await extractPropertyFieldsWithGemini(text, options);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not parse description.",
    };
  }

  const criteria = extractedToCriteria(fields);
  if (!Object.keys(criteria).length) {
    return {
      ok: false,
      error: "No searchable details found in that description.",
    };
  }

  const soft = softFiltersFromCriteria(criteria);
  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false })
    .limit(400);

  if (soft.property_type) {
    query = query.eq("property_type", soft.property_type);
  }
  if (soft.opportunity_type) {
    query = query.eq("opportunity_type", soft.opportunity_type);
  }
  if (soft.city) {
    query = query.ilike("city", `%${soft.city}%`);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  let rows = (data ?? []) as MatchableProperty[];

  // If soft filters were too tight, widen to type-only or unfiltered sample.
  if (rows.length < 5 && (soft.city || soft.opportunity_type)) {
    let wide = supabase
      .from("properties")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(400);
    if (soft.property_type) {
      wide = wide.eq("property_type", soft.property_type);
    }
    const { data: wideData } = await wide;
    rows = (wideData ?? []) as MatchableProperty[];
  }

  const scored = rows
    .map((row) => scorePropertyMatch(row, criteria))
    .filter((r) => r.match_percent > 0)
    .sort((a, b) => b.match_percent - a.match_percent || b.created_at.localeCompare(a.created_at))
    .slice(0, 75);

  return { ok: true, criteria, results: scored };
}
