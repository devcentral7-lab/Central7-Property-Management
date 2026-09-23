"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { loadFormOptions } from "@/lib/form-options";
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
    const options = await loadFormOptions();
    const fields = await extractPropertyFieldsWithGemini(paragraph, options);
    return { ok: true, fields, configured: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    return { ok: false, error: message, configured: true };
  }
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await logAudit({
      category: "auth",
      action: "logout",
      summary: "Signed out",
      subjectType: "session",
      subjectLabel: user.email ?? user.id,
      details: { auth_user_id: user.id, email: user.email },
    });
  }
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

async function buildPropertyPayload(formData: FormData) {
  const options = await loadFormOptions();
  const propertyType = str(formData.get("property_type"));
  const opportunityType = str(formData.get("opportunity_type"));
  const contactName = str(formData.get("contact_name"));
  const contact1 = str(formData.get("contact_phone_1"));
  const city = str(formData.get("city"));

  if (!contactName || !contact1 || !opportunityType || !propertyType || !city) {
    throw new Error("Contact name, phone, opportunity, type, and city are required.");
  }
  if (!options.opportunityTypes.includes(opportunityType)) {
    throw new Error("Invalid opportunity type");
  }
  if (!options.propertyTypes.includes(propertyType)) {
    throw new Error("Invalid property type");
  }

  const amenitiesRaw = str(formData.get("amenities"));
  const amenitiesFromBoxes = formData
    .getAll("amenity")
    .map((v) => String(v).trim())
    .filter((a) => a && options.amenities.includes(a));
  const amenities = [
    ...new Set([
      ...amenitiesFromBoxes,
      ...amenitiesRaw
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    ]),
  ];

  const type_attributes: Record<string, unknown> = {};
  if (propertyType === "Land") {
    type_attributes.suitable_for = str(formData.get("suitable_for")) || null;
  }
  if (propertyType === "Commercial Property") {
    type_attributes.built_up_area = num(formData.get("built_up_area"));
  }

  let contact_type: string | null = str(formData.get("contact_type")) || null;
  if (contact_type && !options.contactTypes.includes(contact_type)) {
    contact_type = null;
  }

  let furnished: string | null = str(formData.get("furnished")) || null;
  if (furnished && !options.furnished.includes(furnished)) {
    furnished = null;
  }

  let currency = str(formData.get("currency")) || "LKR";
  if (!options.currencies.includes(currency)) {
    currency = options.currencies[0] || "LKR";
  }

  let status = str(formData.get("status")) || "Active";
  if (!options.statuses.includes(status)) {
    status = options.statuses.includes("Active")
      ? "Active"
      : options.statuses[0] || "Active";
  }

  const complexId = str(formData.get("apartment_complex_id"));
  const lat = num(formData.get("latitude"));
  const lng = num(formData.get("longitude"));

  return {
    row: {
      contact_type,
      contact_name: contactName,
      contact_phone_1: contact1,
      contact_phone_2: str(formData.get("contact_phone_2")) || null,
      contact_email: str(formData.get("contact_email")) || null,
      opportunity_type: opportunityType,
      property_type: propertyType,
      purpose: str(formData.get("purpose")) || null,
      property_subtype: str(formData.get("property_subtype")) || null,
      address: str(formData.get("address")) || null,
      city,
      land_size_perch: num(formData.get("land_size_perch")),
      floor_area_sqft: num(formData.get("floor_area_sqft")),
      bedrooms: num(formData.get("bedrooms")),
      bathrooms: num(formData.get("bathrooms")),
      number_of_floors: num(formData.get("number_of_floors")),
      parking_spaces: num(formData.get("parking_spaces")),
      age_years: num(formData.get("age_years")),
      apartment_complex_id: complexId || null,
      apartment_floor: str(formData.get("apartment_floor")) || null,
      view: str(formData.get("view")) || null,
      currency,
      price_per_perch: num(formData.get("price_per_perch")),
      price_per_sqft: num(formData.get("price_per_sqft")),
      price_total: num(formData.get("price_total")),
      budget: num(formData.get("budget")),
      furnished,
      status,
      do_not_publish: formData.get("do_not_publish") === "on",
      amenities,
      comments: str(formData.get("comments")) || null,
      type_attributes,
    },
    lat,
    lng,
    platforms: options.platforms.filter(
      (p) => formData.get(`platform_${p}`) === "on",
    ),
  };
}

async function applyLocation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  lat: number | null,
  lng: number | null,
) {
  if (lat == null && lng == null) {
    await supabase.rpc("set_property_location", {
      p_property_id: propertyId,
      p_lat: null,
      p_lng: null,
    });
    return;
  }
  if (lat == null || lng == null) {
    throw new Error("Provide both latitude and longitude, or leave both blank.");
  }
  const { error } = await supabase.rpc("set_property_location", {
    p_property_id: propertyId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
}

export async function createProperty(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { row, lat, lng, platforms } = await buildPropertyPayload(formData);

  if (!row.do_not_publish && platforms.length === 0) {
    throw new Error("Select at least one platform, or mark Do Not Publish.");
  }

  const { data: refRow, error: refErr } = await supabase.rpc("next_property_ref");
  if (refErr) throw refErr;
  const ref = Array.isArray(refRow) ? refRow[0] : refRow;

  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      ...row,
      ref_no: ref?.ref_no as string,
      ref_seq: ref?.ref_seq as number,
      created_by: profile.id,
      created_by_name: profile.display_name,
    })
    .select("id, ref_no")
    .single();
  if (error) throw error;

  await applyLocation(supabase, property.id, lat, lng);

  if (!row.do_not_publish) {
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

  await logAudit({
    category: "property",
    action: "create",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: property.id,
    subjectLabel: property.ref_no,
    summary: `Created listing ${property.ref_no} (${row.property_type} · ${row.city})`,
    details: {
      property_type: row.property_type,
      opportunity_type: row.opportunity_type,
      city: row.city,
      status: row.status,
      do_not_publish: row.do_not_publish,
      platforms,
    },
  });

  revalidatePath("/app/properties");
  revalidatePath("/app/activity");
  redirect(`/app/properties/${property.ref_no}`);
}

export async function updateProperty(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const refNo = str(formData.get("ref_no")).toUpperCase();
  if (!refNo) throw new Error("Missing ref");

  const { data: existing, error: findErr } = await supabase
    .from("properties")
    .select("id, ref_no, created_by, created_by_name")
    .eq("ref_no", refNo)
    .single();
  if (findErr || !existing) throw findErr ?? new Error("Property not found");

  const isOwner =
    existing.created_by === profile.id ||
    (!existing.created_by && existing.created_by_name === profile.display_name);
  if (profile.role !== "Admin" && !isOwner) {
    throw new Error("Only owner or Admin can edit this listing");
  }

  const { row, lat, lng } = await buildPropertyPayload(formData);
  const { error } = await supabase
    .from("properties")
    .update(row)
    .eq("id", existing.id);
  if (error) throw error;

  await applyLocation(supabase, existing.id, lat, lng);

  await logAudit({
    category: "property",
    action: "update",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: existing.id,
    subjectLabel: refNo,
    summary: `Updated listing ${refNo}`,
    details: {
      property_type: row.property_type,
      status: row.status,
      city: row.city,
    },
  });

  revalidatePath(`/app/properties/${refNo}`);
  revalidatePath("/app/properties");
  revalidatePath("/app/activity");
  redirect(`/app/properties/${refNo}`);
}

export async function updatePropertyStatus(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const options = await loadFormOptions();
  const refNo = str(formData.get("ref_no")).toUpperCase();
  const action = str(formData.get("action"));
  const comment = str(formData.get("comment"));

  if (!options.statusChangeOptions.includes(action)) {
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
    nextStatus = options.statuses.includes("Active")
      ? "Active"
      : property.status;
  } else if (options.statuses.includes(action)) {
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

  await logAudit({
    category: "property",
    action: `status:${action}`,
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: property.id,
    subjectLabel: property.ref_no,
    summary: `${action} on ${property.ref_no}${assignedTo ? ` → ${assignedTo}` : ""}`,
    details: {
      previous_status: property.status,
      next_status: nextStatus,
      comment: comment || null,
      assigned_to: assignedTo,
    },
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
