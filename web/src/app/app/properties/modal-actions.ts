"use server";

import { requireProfile } from "@/lib/auth";
import { loadFormOptions, type FormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";
import type { ComplexOption } from "@/app/app/properties/new/property-form";

function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string" && !v.trim()) return false;
  if (Array.isArray(v) && !v.length) return false;
  return true;
}

function s(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function typeSpecificKeys(propertyType: string): Set<string> {
  if (propertyType === "Land") {
    return new Set(["land_size_perch", "suitable_for"]);
  }
  if (propertyType === "Apartment") {
    return new Set([
      "apartment_complex",
      "apartment_floor",
      "bedrooms",
      "bathrooms",
      "floor_area_sqft",
      "parking_spaces",
      "view",
    ]);
  }
  if (propertyType === "Commercial Property") {
    return new Set(["purpose", "land_size_perch", "built_up_area"]);
  }
  return new Set([
    "purpose",
    "land_size_perch",
    "bedrooms",
    "bathrooms",
    "floor_area_sqft",
    "number_of_floors",
    "parking_spaces",
    "age_years",
  ]);
}

export type PropertyModalField = { label: string; value: string };

export type PropertyModalEvent = {
  id: string;
  action: string;
  actor_name: string | null;
  assigned_to: string | null;
  comment: string | null;
};

export type PropertyModalData = {
  refNo: string;
  headline: string;
  comments: string | null;
  fields: PropertyModalField[];
  events: PropertyModalEvent[];
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  statusChangeOptions: string[];
  complexes: ComplexOption[];
  options: FormOptions;
  initialDoNotPublish: boolean;
  initialAmenities: string[];
  initialValues: Record<string, string>;
};

export type PropertyModalResult =
  | { ok: true; data: PropertyModalData }
  | { ok: false; error: string };

export async function getPropertyModalData(
  refNoRaw: string,
): Promise<PropertyModalResult> {
  try {
    const profile = await requireProfile();
    const refNo = decodeURIComponent(refNoRaw).toUpperCase();
    const supabase = await createClient();

    const { data: property, error } = await supabase
      .from("properties")
      .select("*")
      .eq("ref_no", refNo)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!property) return { ok: false, error: "Property not found" };

    const isOwner =
      property.created_by === profile.id ||
      (!property.created_by &&
        property.created_by_name === profile.display_name);
    const canEdit = profile.role === "Admin" || isOwner;
    const canDelete = profile.role === "Admin";

    const [{ data: events }, { data: coords }, { data: complex }, options] =
      await Promise.all([
        supabase
          .from("property_status_events")
          .select(
            "id, occurred_at, actor_name, action, comment, assigned_to",
          )
          .eq("ref_no", refNo)
          .is("archived_at", null)
          .order("occurred_at", { ascending: false })
          .limit(20),
        supabase.rpc("get_property_location", { p_property_id: property.id }),
        property.apartment_complex_id
          ? supabase
              .from("apartment_complexes")
              .select("name")
              .eq("id", property.apartment_complex_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        loadFormOptions(),
      ]);

    const { data: complexes } = await supabase
      .from("apartment_complexes")
      .select("id, name")
      .order("name");

    const coord = Array.isArray(coords) ? coords[0] : coords;
    const attrs = (property.type_attributes || {}) as Record<string, unknown>;
    const amenities = (property.amenities || []) as string[];
    const allowedType = typeSpecificKeys(String(property.property_type || ""));

    const candidates: {
      key: string;
      label: string;
      value: unknown;
      group: "common" | "type";
    }[] = [
      { key: "contact_type", label: "Contact type", value: property.contact_type, group: "common" },
      { key: "contact_name", label: "Contact", value: property.contact_name, group: "common" },
      { key: "contact_phone_1", label: "Phone 1", value: property.contact_phone_1, group: "common" },
      { key: "contact_phone_2", label: "Phone 2", value: property.contact_phone_2, group: "common" },
      { key: "contact_email", label: "Email", value: property.contact_email, group: "common" },
      { key: "opportunity_type", label: "Opportunity", value: property.opportunity_type, group: "common" },
      { key: "property_type", label: "Property type", value: property.property_type, group: "common" },
      { key: "property_subtype", label: "Sub-type", value: property.property_subtype, group: "common" },
      { key: "status", label: "Status", value: property.status, group: "common" },
      { key: "city", label: "City", value: property.city, group: "common" },
      { key: "address", label: "Address", value: property.address, group: "common" },
      {
        key: "coordinates",
        label: "Coordinates",
        value:
          coord?.lat != null && coord?.lng != null
            ? `${coord.lat}, ${coord.lng}`
            : null,
        group: "common",
      },
      { key: "purpose", label: "Purpose", value: property.purpose, group: "type" },
      { key: "land_size_perch", label: "Land (perch)", value: property.land_size_perch, group: "type" },
      { key: "floor_area_sqft", label: "Floor area (sqft)", value: property.floor_area_sqft, group: "type" },
      { key: "bedrooms", label: "Bedrooms", value: property.bedrooms, group: "type" },
      { key: "bathrooms", label: "Bathrooms", value: property.bathrooms, group: "type" },
      { key: "number_of_floors", label: "Floors", value: property.number_of_floors, group: "type" },
      { key: "parking_spaces", label: "Parking", value: property.parking_spaces, group: "type" },
      { key: "age_years", label: "Age (years)", value: property.age_years, group: "type" },
      { key: "apartment_complex", label: "Apartment complex", value: complex?.name, group: "type" },
      { key: "apartment_floor", label: "Apartment floor", value: property.apartment_floor, group: "type" },
      { key: "view", label: "View", value: property.view, group: "type" },
      { key: "suitable_for", label: "Suitable for", value: attrs.suitable_for, group: "type" },
      { key: "built_up_area", label: "Built-up area", value: attrs.built_up_area, group: "type" },
      { key: "currency", label: "Currency", value: property.currency, group: "common" },
      { key: "price_per_perch", label: "Price per perch", value: property.price_per_perch, group: "common" },
      { key: "price_per_sqft", label: "Price per sqft", value: property.price_per_sqft, group: "common" },
      {
        key: "price_total",
        label: "Price total",
        value:
          property.price_total != null
            ? `${property.currency} ${Number(property.price_total).toLocaleString()}`
            : null,
        group: "common",
      },
      { key: "budget", label: "Budget", value: property.budget, group: "common" },
      { key: "furnished", label: "Furnished", value: property.furnished, group: "common" },
      {
        key: "do_not_publish",
        label: "Do not publish",
        value: property.do_not_publish ? "Yes" : null,
        group: "common",
      },
      {
        key: "amenities",
        label: "Amenities",
        value: amenities.length ? amenities.join(", ") : null,
        group: "common",
      },
      { key: "created_by_name", label: "Created by", value: property.created_by_name, group: "common" },
      {
        key: "created_at",
        label: "Created",
        value: property.created_at
          ? new Date(property.created_at).toLocaleString()
          : null,
        group: "common",
      },
    ];

    const fields = candidates
      .filter((f) => {
        if (!hasValue(f.value)) return false;
        if (f.group === "type" && !allowedType.has(f.key)) return false;
        return true;
      })
      .map((f) => ({ label: f.label, value: String(f.value) }));

    const known = new Set(options.amenities);
    const knownAmenities = amenities.filter((a) => known.has(a));
    const customAmenities = amenities.filter((a) => !known.has(a)).join(", ");

    return {
      ok: true,
      data: {
        refNo: property.ref_no,
        headline: `${property.property_type} · ${property.opportunity_type} · ${property.status}`,
        comments: property.comments,
        fields,
        events: (events ?? []).map((e) => ({
          id: e.id,
          action: String(e.action),
          actor_name: e.actor_name,
          assigned_to: e.assigned_to,
          comment: e.comment,
        })),
        canEdit,
        canDelete,
        canChangeStatus: canEdit,
        statusChangeOptions: options.statusChangeOptions,
        complexes: (complexes ?? []) as ComplexOption[],
        options,
        initialDoNotPublish: Boolean(property.do_not_publish),
        initialAmenities: knownAmenities,
        initialValues: {
          contact_type: s(property.contact_type),
          contact_name: s(property.contact_name),
          contact_phone_1: s(property.contact_phone_1),
          contact_phone_2: s(property.contact_phone_2),
          contact_email: s(property.contact_email),
          opportunity_type:
            s(property.opportunity_type) ||
            options.opportunityTypes[0] ||
            "Sell",
          property_type:
            s(property.property_type) || options.propertyTypes[0] || "House",
          property_subtype: s(property.property_subtype),
          city: s(property.city),
          address: s(property.address),
          purpose: s(property.purpose),
          land_size_perch: s(property.land_size_perch),
          floor_area_sqft: s(property.floor_area_sqft),
          bedrooms: s(property.bedrooms),
          bathrooms: s(property.bathrooms),
          number_of_floors: s(property.number_of_floors),
          parking_spaces: s(property.parking_spaces),
          age_years: s(property.age_years),
          apartment_complex_id: s(property.apartment_complex_id),
          apartment_floor: s(property.apartment_floor),
          view: s(property.view),
          latitude: coord?.lat != null ? String(coord.lat) : "",
          longitude: coord?.lng != null ? String(coord.lng) : "",
          suitable_for: s(attrs.suitable_for),
          built_up_area: s(attrs.built_up_area),
          currency: s(property.currency) || options.currencies[0] || "LKR",
          furnished: s(property.furnished),
          status: s(property.status) || "Active",
          price_per_perch: s(property.price_per_perch),
          price_per_sqft: s(property.price_per_sqft),
          price_total: s(property.price_total),
          budget: s(property.budget),
          amenities: customAmenities,
          comments: s(property.comments),
        },
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load property",
    };
  }
}
