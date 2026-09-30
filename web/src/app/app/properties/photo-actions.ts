"use server";

import { after } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireProfile } from "@/lib/auth";
import {
  ALLOWED_PHOTO_MIME,
  DrivePhotosError,
  deletePropertyPhoto,
  isDriveConfigured,
  listPropertyPhotos,
  MAX_PHOTO_BYTES,
  renamePropertyPhoto,
  uploadPropertyPhotos,
  type DrivePhoto,
} from "@/lib/drive/photos";
import { withSavedOrder } from "@/lib/drive/saved-order";
import { createClient } from "@/lib/supabase/server";

export type PhotoListResult =
  | {
      ok: true;
      configured: boolean;
      canManage: boolean;
      photos: DrivePhoto[];
    }
  | { ok: false; error: string; configured: boolean };

async function loadPropertyForPhotos(refNoRaw: string) {
  const refNo = decodeURIComponent(refNoRaw).toUpperCase();
  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select("id, ref_no, created_by, created_by_name, status")
    .eq("ref_no", refNo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!property) throw new Error("Property not found");
  return property;
}

async function livePhotos(propertyId: string, refNo: string): Promise<DrivePhoto[]> {
  const supabase = await createClient();
  const photos = await withSavedOrder(supabase, propertyId, await listPropertyPhotos(refNo));
  after(() => syncPropertyMedia(propertyId, photos));
  return photos;
}

async function syncPropertyMedia(
  propertyId: string,
  photos: DrivePhoto[],
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("property_media")
      .select("id, drive_file_id")
      .eq("property_id", propertyId);

    const existingIds = new Set((existing ?? []).map((r) => r.drive_file_id));
    const liveIds = new Set(photos.map((p) => p.id));

    const toDelete = (existing ?? [])
      .filter((r) => !liveIds.has(r.drive_file_id))
      .map((r) => r.id);
    if (toDelete.length) {
      await supabase.from("property_media").delete().in("id", toDelete);
    }

    const toInsert = photos
      .filter((p) => !existingIds.has(p.id))
      .map((p, i) => ({
        property_id: propertyId,
        drive_file_id: p.id,
        file_name: p.name,
        mime_type: p.mimeType,
        sort_order: i,
      }));
    if (toInsert.length) {
      await supabase.from("property_media").upsert(toInsert, {
        onConflict: "property_id,drive_file_id",
      });
    }

    // Best-effort sort order update
    for (let i = 0; i < photos.length; i++) {
      await supabase
        .from("property_media")
        .update({
          sort_order: i,
          file_name: photos[i].name,
          mime_type: photos[i].mimeType,
        })
        .eq("property_id", propertyId)
        .eq("drive_file_id", photos[i].id);
    }
  } catch (e) {
    console.error("syncPropertyMedia", e);
  }
}

export async function listPropertyPhotosAction(
  refNoRaw: string,
): Promise<PhotoListResult> {
  const configured = isDriveConfigured();
  try {
    const profile = await requireProfile();
    const property = await loadPropertyForPhotos(refNoRaw);
    const isOwner =
      property.created_by === profile.id ||
      (!property.created_by &&
        property.created_by_name === profile.display_name);
    const canManage = profile.role === "Admin" || isOwner;

    if (!configured) {
      return { ok: true, configured: false, canManage, photos: [] };
    }

    const photos = await livePhotos(property.id, property.ref_no);
    return { ok: true, configured: true, canManage, photos };
  } catch (e) {
    const message =
      e instanceof DrivePhotosError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed to load photos";
    return { ok: false, error: message, configured };
  }
}

/** Public / guest: Active listings only. Soft-fails. */
export async function listPublicPropertyPhotosAction(
  refNoRaw: string,
): Promise<PhotoListResult> {
  const configured = isDriveConfigured();
  try {
    if (!configured) {
      return { ok: true, configured: false, canManage: false, photos: [] };
    }
    const refNo = decodeURIComponent(refNoRaw).toUpperCase();
    const supabase = await createClient();
    const { data: card } = await supabase
      .from("property_public_cards")
      .select("ref_no, status")
      .eq("ref_no", refNo)
      .maybeSingle();
    if (!card || card.status !== "Active") {
      return { ok: true, configured: true, canManage: false, photos: [] };
    }
    const photos = await listPropertyPhotos(refNo);
    return { ok: true, configured: true, canManage: false, photos };
  } catch (e) {
    const message =
      e instanceof DrivePhotosError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed to load photos";
    return { ok: false, error: message, configured };
  }
}

export async function uploadPropertyPhotosAction(
  refNoRaw: string,
  formData: FormData,
): Promise<PhotoListResult> {
  const configured = isDriveConfigured();
  try {
    if (!configured) {
      return {
        ok: false,
        error: "Drive photos are not configured",
        configured: false,
      };
    }
    const profile = await requireProfile();
    const property = await loadPropertyForPhotos(refNoRaw);
    const isOwner =
      property.created_by === profile.id ||
      (!property.created_by &&
        property.created_by_name === profile.display_name);
    if (profile.role !== "Admin" && !isOwner) {
      return { ok: false, error: "Not allowed", configured: true };
    }

    const files: { name: string; mimeType: string; buffer: Buffer }[] = [];
    for (const entry of formData.getAll("files")) {
      if (!(entry instanceof File)) continue;
      if (!ALLOWED_PHOTO_MIME.has(entry.type)) {
        return {
          ok: false,
          error: `Unsupported type: ${entry.name}`,
          configured: true,
        };
      }
      if (entry.size > MAX_PHOTO_BYTES) {
        return {
          ok: false,
          error: `File too large: ${entry.name}`,
          configured: true,
        };
      }
      const buf = Buffer.from(await entry.arrayBuffer());
      files.push({
        name: entry.name || "photo.jpg",
        mimeType: entry.type,
        buffer: buf,
      });
    }
    if (!files.length) {
      return { ok: false, error: "No files selected", configured: true };
    }

    await uploadPropertyPhotos(property.ref_no, files);
    await logAudit({
      category: "property",
      action: "photo_upload",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectId: property.id,
      subjectLabel: property.ref_no,
      summary: `Uploaded ${files.length} photo(s) for ${property.ref_no}`,
      details: { count: files.length },
    });

    const photos = await livePhotos(property.id, property.ref_no);
    return {
      ok: true,
      configured: true,
      canManage: true,
      photos,
    };
  } catch (e) {
    const message =
      e instanceof DrivePhotosError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Upload failed";
    return { ok: false, error: message, configured };
  }
}

export async function deletePropertyPhotoAction(
  refNoRaw: string,
  fileId: string,
): Promise<PhotoListResult> {
  const configured = isDriveConfigured();
  try {
    if (!configured) {
      return {
        ok: false,
        error: "Drive photos are not configured",
        configured: false,
      };
    }
    const profile = await requireProfile();
    const property = await loadPropertyForPhotos(refNoRaw);
    const isOwner =
      property.created_by === profile.id ||
      (!property.created_by &&
        property.created_by_name === profile.display_name);
    if (profile.role !== "Admin" && !isOwner) {
      return { ok: false, error: "Not allowed", configured: true };
    }

    await deletePropertyPhoto(property.ref_no, fileId);
    await logAudit({
      category: "property",
      action: "photo_delete",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectId: property.id,
      subjectLabel: property.ref_no,
      summary: `Deleted photo on ${property.ref_no}`,
      details: { fileId },
    });

    const photos = await livePhotos(property.id, property.ref_no);
    return { ok: true, configured: true, canManage: true, photos };
  } catch (e) {
    const message =
      e instanceof DrivePhotosError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Delete failed";
    return { ok: false, error: message, configured };
  }
}

export async function renamePropertyPhotoAction(
  refNoRaw: string,
  fileId: string,
  name: string,
): Promise<PhotoListResult> {
  const configured = isDriveConfigured();
  try {
    if (!configured) {
      return {
        ok: false,
        error: "Drive photos are not configured",
        configured: false,
      };
    }
    const profile = await requireProfile();
    const property = await loadPropertyForPhotos(refNoRaw);
    const isOwner =
      property.created_by === profile.id ||
      (!property.created_by &&
        property.created_by_name === profile.display_name);
    if (profile.role !== "Admin" && !isOwner) {
      return { ok: false, error: "Not allowed", configured: true };
    }

    await renamePropertyPhoto(property.ref_no, fileId, name);
    await logAudit({
      category: "property",
      action: "photo_rename",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectId: property.id,
      subjectLabel: property.ref_no,
      summary: `Renamed photo on ${property.ref_no}`,
      details: { fileId, name },
    });

    const photos = await livePhotos(property.id, property.ref_no);
    return { ok: true, configured: true, canManage: true, photos };
  } catch (e) {
    const message =
      e instanceof DrivePhotosError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Rename failed";
    return { ok: false, error: message, configured };
  }
}

export async function reorderPropertyPhotosAction(
  refNoRaw: string,
  orderedFileIds: string[],
): Promise<PhotoListResult> {
  const configured = isDriveConfigured();
  try {
    if (!configured) {
      return {
        ok: false,
        error: "Drive photos are not configured",
        configured: false,
      };
    }
    const profile = await requireProfile();
    const property = await loadPropertyForPhotos(refNoRaw);
    const isOwner =
      property.created_by === profile.id ||
      (!property.created_by &&
        property.created_by_name === profile.display_name);
    if (profile.role !== "Admin" && !isOwner) {
      return { ok: false, error: "Not allowed", configured: true };
    }

    const live = await listPropertyPhotos(property.ref_no);
    const byId = new Map(live.map((p) => [p.id, p]));
    const ordered = orderedFileIds
      .map((id) => byId.get(id))
      .filter(Boolean) as DrivePhoto[];
    const rest = live.filter((p) => !orderedFileIds.includes(p.id));
    const photos = [...ordered, ...rest];
    await syncPropertyMedia(property.id, photos);

    return { ok: true, configured: true, canManage: true, photos };
  } catch (e) {
    const message =
      e instanceof DrivePhotosError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Reorder failed";
    return { ok: false, error: message, configured };
  }
}
