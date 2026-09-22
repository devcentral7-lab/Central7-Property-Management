"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  CONTACT_TYPES,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
  SOCIAL_MEDIA_PLATFORMS,
  STATUS_CHANGE_OPTIONS,
  STATUS_LIST,
  type PropertyType,
} from "@/lib/constants";
import {
  extractPropertyFieldsWithGemini,
  isGeminiConfigured,
} from "@/lib/gemini/extract-property";

export type ExtractPropertyResult =
  | { ok: true; fields: Record<string, string>; configured: true }
  | { ok: false; error: string; configured: boolean };

export async function extractPropertyFromParagraph(
  paragraph: string,
): Promise<ExtractPropertyResult> {
  try {
    await requireProfile();
  } catch {
    return { ok: false, error: "Sign in required.", configured: isGeminiConfigured() };
  }

  if (!isGeminiConfigured()) {
    return {
      ok: false,
      configured: false,
      error:
        "Gemini is not configured yet. Add GEMINI_API_KEY to web/.env.local and restart the server — you can still fill the form manually.",
    };
  }

  try {
    const fields = await extractPropertyFieldsWithGemini(paragraph);
    return { ok: true, fields, configured: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    return { ok: false, error: message, configured: true };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function createProperty(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const propertyType = str(formData.get("property_type")) as PropertyType;
  const doNotPublish = formData.get("do_not_publish") === "on";
  const platforms = SOCIAL_MEDIA_PLATFORMS.filter(
    (p) => formData.get(`platform_${p}`) === "on",
  );

  if (!doNotPublish && platforms.length === 0) {
    throw new Error("Select at least one platform, or mark Do Not Publish.");
  }

  const contactName = str(formData.get("contact_name"));
  const contact1 = str(formData.get("contact_phone_1"));
  const opportunityType = str(formData.get("opportunity_type"));
  const city = str(formData.get("city"));
  if (!contactName || !contact1 || !opportunityType || !propertyType || !city) {
    throw new Error("Contact name, phone, opportunity, type, and city are required.");
  }

  const { data: refRow, error: refErr } = await supabase.rpc("next_property_ref");
  if (refErr) throw refErr;
  const ref = Array.isArray(refRow) ? refRow[0] : refRow;
  const ref_no = ref?.ref_no as string;
  const ref_seq = ref?.ref_seq as number;

  const amenities = String(formData.get("amenities") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const type_attributes: Record<string, unknown> = {};
  if (propertyType === "Land") {
    type_attributes.suitable_for = str(formData.get("suitable_for")) || null;
  }
  if (propertyType === "Commercial Property") {
    type_attributes.built_up_area = num(formData.get("built_up_area"));
  }

  const row = {
    ref_no,
    ref_seq,
    created_by: profile.id,
    created_by_name: profile.display_name,
    contact_type: str(formData.get("contact_type")) || null,
    contact_name: contactName,
    contact_phone_1: contact1,
    contact_phone_2: str(formData.get("contact_phone_2")) || null,
    contact_email: str(formData.get("contact_email")) || null,
    opportunity_type: opportunityType,
    property_type: propertyType,
    purpose: str(formData.get("purpose")) || null,
    address: str(formData.get("address")) || null,
    city,
    land_size_perch: num(formData.get("land_size_perch")),
    floor_area_sqft: num(formData.get("floor_area_sqft")),
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    number_of_floors: num(formData.get("number_of_floors")),
    parking_spaces: num(formData.get("parking_spaces")),
    age_years: num(formData.get("age_years")),
    apartment_floor: str(formData.get("apartment_floor")) || null,
    view: str(formData.get("view")) || null,
    currency: str(formData.get("currency")) || "LKR",
    price_per_perch: num(formData.get("price_per_perch")),
    price_per_sqft: num(formData.get("price_per_sqft")),
    price_total: num(formData.get("price_total")),
    budget: num(formData.get("budget")),
    furnished: str(formData.get("furnished")) || null,
    status: "Active",
    do_not_publish: doNotPublish,
    amenities,
    comments: str(formData.get("comments")) || null,
    type_attributes,
  };

  if (!OPPORTUNITY_TYPES.includes(opportunityType as never)) {
    throw new Error("Invalid opportunity type");
  }
  if (!PROPERTY_TYPES.includes(propertyType)) {
    throw new Error("Invalid property type");
  }
  if (row.contact_type && !CONTACT_TYPES.includes(row.contact_type as never)) {
    row.contact_type = null;
  }

  const { data: property, error } = await supabase
    .from("properties")
    .insert(row)
    .select("id, ref_no")
    .single();
  if (error) throw error;

  if (!doNotPublish) {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "assignments")
      .maybeSingle();
    const assignedTo =
      (settings?.value as { new_listing_admin?: string } | null)?.new_listing_admin ||
      "Keerthie";

    await supabase.from("property_status_events").insert({
      property_id: property.id,
      ref_no: property.ref_no,
      actor_id: profile.id,
      actor_name: profile.display_name,
      action: "Publish",
      comment: "",
      requested_platforms: platforms,
      assigned_to: assignedTo,
    });
  }

  revalidatePath("/app/properties");
  redirect(`/app/properties/${property.ref_no}`);
}

export async function updatePropertyStatus(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const refNo = str(formData.get("ref_no")).toUpperCase();
  const action = str(formData.get("action"));
  const comment = str(formData.get("comment"));

  if (!STATUS_CHANGE_OPTIONS.includes(action as never)) {
    throw new Error("Invalid status action");
  }

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, ref_no, status, created_by, created_by_name")
    .eq("ref_no", refNo)
    .single();
  if (error || !property) throw error ?? new Error("Property not found");

  const isOwner =
    property.created_by === profile.id ||
    (!property.created_by &&
      property.created_by_name === profile.display_name);
  if (profile.role !== "Admin" && !isOwner) {
    throw new Error("Only owner or Admin can change status");
  }

  let nextStatus = property.status as string;
  if (action === "Data Change") {
    // no status change
  } else if (["Publish", "Republish", "New Ad Published"].includes(action)) {
    nextStatus = "Active";
  } else if (STATUS_LIST.includes(action as never)) {
    nextStatus = action;
  }

  if (nextStatus !== property.status) {
    const { error: upErr } = await supabase
      .from("properties")
      .update({ status: nextStatus })
      .eq("id", property.id);
    if (upErr) throw upErr;
  }

  let assignedTo: string | null = null;
  if (["Publish", "Republish", "Data Change"].includes(action)) {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "assignments")
      .maybeSingle();
    assignedTo =
      (settings?.value as { new_listing_admin?: string } | null)?.new_listing_admin ||
      "Keerthie";
  }

  await supabase.from("property_status_events").insert({
    property_id: property.id,
    ref_no: property.ref_no,
    actor_id: profile.id,
    actor_name: profile.display_name,
    action,
    comment,
    assigned_to: assignedTo,
  });

  if (["Drop", "Lost", "Hold", "Closed"].includes(action)) {
    await supabase.from("social_media_queue").upsert(
      {
        property_id: property.id,
        ref_no: property.ref_no,
        approved_action: action,
        approved_by: profile.display_name,
        approved_at: new Date().toISOString(),
      },
      { onConflict: "ref_no" },
    );
  }

  revalidatePath(`/app/properties/${refNo}`);
  revalidatePath("/app/activity");
}
