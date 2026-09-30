import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrivePhoto } from "@/lib/drive/types";

/** Drive lists by file name; staff drag-and-drop order lives in property_media. */
export async function withSavedOrder(
  supabase: SupabaseClient,
  propertyId: string,
  photos: DrivePhoto[],
): Promise<DrivePhoto[]> {
  const { data } = await supabase
    .from("property_media")
    .select("drive_file_id, sort_order")
    .eq("property_id", propertyId);
  if (!data?.length) return photos;
  const rank = new Map(data.map((r) => [r.drive_file_id as string, r.sort_order as number]));
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort(
      (a, b) =>
        (rank.get(a.photo.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.photo.id) ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
    )
    .map((x) => x.photo);
}
