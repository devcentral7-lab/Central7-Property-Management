"use server";

import { requireProfile } from "@/lib/auth";
import { loadCities } from "@/lib/cities-server";
import { loadComplexOptions } from "@/lib/complexes-server";
import { loadFormOptions } from "@/lib/form-options";
import {
  extractPropertyFieldsWithGemini,
  isGeminiConfigured,
} from "@/lib/gemini/extract-property";
import { paragraphFieldsToFilters } from "@/lib/paragraph-search-filters";
import type { SearchFilterValues } from "./property-search-form";
import { createClient } from "@/lib/supabase/server";

export type ParagraphSearchResult =
  | {
      ok: true;
      filters: Partial<SearchFilterValues>;
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
  try {
    const [options, cities, complexes] = await Promise.all([loadFormOptions(), loadCities(), loadComplexOptions()]);
    const { fields } = await extractPropertyFieldsWithGemini(text, options, true, { cities, complexes });
    const filters = paragraphFieldsToFilters(fields);
    if (!Object.keys(filters).length) {
      return { ok: false, error: "No filter details found. Include a city, property type, price, or room count." };
    }
    return { ok: true, filters };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not parse description." };
  }
}
