"use server";

import { requireProfile } from "@/lib/auth";
import { loadFormOptions, type FormOptions } from "@/lib/form-options";
import { buildPropertyDetails, type PropertyDetailsModel } from "@/lib/property-details";
import { createClient } from "@/lib/supabase/server";
import type { ComplexOption } from "@/app/app/properties/new/property-form";

function s(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export type PropertyModalEvent = {
  id: string;
  action: string;
  actor_name: string | null;
  assigned_to: string | null;
  comment: string | null;
  occurred_at: string | null;
};

export type PropertyModalData = {
  refNo: string;
  headline: string;
  comments: string | null;
  internalComments: string | null;
  details: PropertyDetailsModel;
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

    const [{ data: events }, { data: complex }, options] =
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

    const attrs = (property.type_attributes || {}) as Record<string, unknown>;
    const amenities = (property.amenities || []) as string[];
    const details = buildPropertyDetails(property, {
      complexName: complex?.name ?? null,
    });

    const known = new Set(options.amenities);
    const knownAmenities = amenities.filter((a) => known.has(a));
    const customAmenities = amenities.filter((a) => !known.has(a)).join(", ");

    return {
      ok: true,
      data: {
        refNo: property.ref_no,
        headline: `${property.property_type} · ${property.opportunity_type} · ${property.status}`,
        comments: property.comments,
        internalComments: property.internal_comments,
        details,
        events: (events ?? []).map((e) => ({
          id: e.id,
          action: String(e.action),
          actor_name: e.actor_name,
          assigned_to: e.assigned_to,
          comment: e.comment,
          occurred_at: e.occurred_at,
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
          location_url: s(property.location_url),
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
          internal_comments: s(property.internal_comments),
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
