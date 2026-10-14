import { createClient } from "@/lib/supabase/server";

export type SocialMediaStatus = {
  /** "never" also covers listings imported without any posting history. */
  state: "published" | "taken_down" | "never";
  /** Platforms the listing is live on, with when it was last posted there. */
  live: { platform: string; at: string | null }[];
  /** Last take-down, when nothing is live any more. */
  removed: { action: string; platforms: string[]; at: string | null } | null;
  /** Request still going through approval / posting. */
  pending: {
    action: string;
    stage: "awaiting_approval" | "approved";
    platforms: string[];
    done: string[];
  } | null;
};

/** Worked out in the database (`property_social_status`), which search filters also use. */
export async function loadSocialMediaStatus(refNo: string): Promise<SocialMediaStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("property_social_status", { p_ref: refNo });
  if (error || !data) return null;
  return data as SocialMediaStatus;
}
