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

const SELECT_COLS =
  "id, ref_no, created_at, created_by_name, opportunity_type, property_type, property_subtype, city, address, status, currency, price_total, budget, land_size_perch, floor_area_sqft, bedrooms, bathrooms, number_of_floors, parking_spaces, age_years, purpose, view, furnished, contact_type, contact_name, amenities, comments";

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
