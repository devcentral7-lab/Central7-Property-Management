import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyForm } from "../../new/property-form";
import { requireProfile } from "@/lib/auth";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

function s(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const refNo = decodeURIComponent(ref).toUpperCase();
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("ref_no", refNo)
    .maybeSingle();

  if (error || !property) notFound();

  const isOwner =
    property.created_by === profile.id ||
    (!property.created_by &&
      property.created_by_name === profile.display_name);
  if (profile.role !== "Admin" && !isOwner) {
    notFound();
  }

  const [{ data: complexes }, { data: coords }, options] = await Promise.all([
    supabase.from("apartment_complexes").select("id, name").order("name"),
    supabase.rpc("get_property_location", { p_property_id: property.id }),
    loadFormOptions(),
  ]);

  const coord = Array.isArray(coords) ? coords[0] : coords;
  const attrs = (property.type_attributes || {}) as Record<string, unknown>;
  const amenities = (property.amenities || []) as string[];
  const known = new Set(options.amenities);
  const knownAmenities = amenities.filter((a) => known.has(a));
  const customAmenities = amenities.filter((a) => !known.has(a)).join(", ");

  return (
    <div className="max-w-3xl">
      <Link
        href={`/app/properties/${property.ref_no}`}
        className="text-sm text-[var(--muted)] hover:underline"
      >
        ← {property.ref_no}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold">Edit listing</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Update any field. Status changes for publish workflows still use the
        detail page activity form.
      </p>
      <div className="mt-8">
        <PropertyForm
          mode="edit"
          refNo={property.ref_no}
          complexes={complexes ?? []}
          options={options}
          initialDoNotPublish={Boolean(property.do_not_publish)}
          initialAmenities={knownAmenities}
          initialValues={{
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
          }}
        />
      </div>
    </div>
  );
}
