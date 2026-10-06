import type { NamedOption } from "@/lib/listing-match";
import { createClient } from "@/lib/supabase/server";

export async function loadComplexOptions(): Promise<NamedOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("apartment_complexes").select("id, name, location").order("name");
  if (error) {
    console.error("loadComplexOptions", error.message);
    return [];
  }
  return (data ?? []) as NamedOption[];
}
