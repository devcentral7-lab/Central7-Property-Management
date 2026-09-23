import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePropertyStatus } from "@/app/app/actions";
import { DeletePropertyButton } from "@/app/app/properties/[ref]/delete-property-button";
import { requireProfile } from "@/lib/auth";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string" && !v.trim()) return false;
  if (Array.isArray(v) && !v.length) return false;
  return true;
}

function display(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

type Field = { label: string; value: unknown; group: "common" | "type" };

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
  // House, Estate, and unknown types
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

export async function loadPropertyDetail(refNoRaw: string) {
  const refNo = decodeURIComponent(refNoRaw).toUpperCase();
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
  const canEdit = profile.role === "Admin" || isOwner;
  const canDelete = profile.role === "Admin";

  const [{ data: events }, { data: coords }, { data: complex }, options] =
    await Promise.all([
      supabase
        .from("property_status_events")
        .select(
          "id, occurred_at, actor_name, action, comment, assigned_to, requested_platforms",
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

  const coord = Array.isArray(coords) ? coords[0] : coords;
  const attrs = (property.type_attributes || {}) as Record<string, unknown>;
  const amenities = (property.amenities || []) as string[];
  const allowedType = typeSpecificKeys(String(property.property_type || ""));

  const candidates: (Field & { key: string })[] = [
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

  const fields = candidates.filter((f) => {
    if (!hasValue(f.value)) return false;
    if (f.group === "type" && !allowedType.has(f.key)) return false;
    return true;
  });

  return {
    property,
    events: events ?? [],
    fields,
    options,
    canEdit,
    canDelete,
    canChangeStatus: canEdit,
  };
}

type DetailProps = {
  refNo: string;
  compact?: boolean;
};

export async function PropertyDetailContent({ refNo, compact }: DetailProps) {
  const {
    property,
    events,
    fields,
    options,
    canEdit,
    canDelete,
    canChangeStatus,
  } = await loadPropertyDetail(refNo);

  return (
    <div
      className={
        compact
          ? "grid gap-5 lg:grid-cols-[1.35fr_0.75fr]"
          : "grid gap-8 lg:grid-cols-[1.4fr_0.8fr]"
      }
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[var(--brand-deep)]">
              {property.ref_no}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {property.property_type} · {property.opportunity_type} ·{" "}
              {property.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link
                href={`/app/properties/${property.ref_no}/edit`}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
              >
                Edit listing
              </Link>
            ) : null}
            {canDelete ? (
              <DeletePropertyButton refNo={property.ref_no} />
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {f.label}
              </dt>
              <dd className="mt-0.5 text-sm">{display(f.value)}</dd>
            </div>
          ))}
          {!fields.length ? (
            <p className="text-sm text-[var(--muted)] sm:col-span-2 lg:col-span-3">
              No details to show.
            </p>
          ) : null}
        </dl>

        {property.comments ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="font-display text-base font-semibold">Comments</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {property.comments}
            </p>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        {canChangeStatus ? (
          <form
            action={updatePropertyStatus}
            className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
          >
            <h2 className="font-display text-base font-semibold">
              Update status
            </h2>
            <input type="hidden" name="ref_no" value={property.ref_no} />
            <select
              name="action"
              required
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              defaultValue="Data Change"
            >
              {options.statusChangeOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <textarea
              name="comment"
              rows={2}
              placeholder="Comment"
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-[var(--brand)] py-2 text-sm font-semibold text-white"
            >
              Submit
            </button>
          </form>
        ) : null}

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-display text-base font-semibold">
            Recent activity
          </h2>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
            {events.map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--line)] pb-2 text-sm last:border-0"
              >
                <p className="font-semibold">{e.action}</p>
                <p className="text-xs text-[var(--muted)]">
                  {e.actor_name || "—"}
                  {e.assigned_to ? ` → ${e.assigned_to}` : ""}
                </p>
                {e.comment ? (
                  <p className="mt-1 text-[var(--muted)]">{e.comment}</p>
                ) : null}
              </li>
            ))}
            {!events.length ? (
              <li className="text-sm text-[var(--muted)]">No events yet.</li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}
