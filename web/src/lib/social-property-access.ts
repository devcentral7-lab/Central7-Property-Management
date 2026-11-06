import type { Profile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when this staff role may only open listings that appear on the social queue. */
export function isSocialOnlyViewer(profile: Profile): boolean {
  return profile.role === "Social Media Manager";
}

/** Whether `refNo` has (or had) a social media queue row. */
export async function propertyOnSocialQueue(
  supabase: SupabaseClient,
  refNo: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("social_media_queue")
    .select("id")
    .eq("ref_no", refNo)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}
