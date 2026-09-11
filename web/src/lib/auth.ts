import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, mobile_number, role, photo_drive_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.active) throw new Error("Profile inactive or missing");
  return data as Profile;
}

export async function getOptionalProfile(): Promise<Profile | null> {
  try {
    return await requireProfile();
  } catch {
    return null;
  }
}
