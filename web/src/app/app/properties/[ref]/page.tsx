import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePropertyStatus } from "@/app/app/actions";
import { requireProfile } from "@/lib/auth";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

function display(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export default async function PropertyDetailPage({
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
  const canEdit = profile.role === "Admin" || isOwner;
  const canChangeStatus = canEdit;

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

  const fields: [string, unknown][] = [
    ["Contact type", property.contact_type],
    ["Contact", property.contact_name],
    ["Phone 1", property.contact_phone_1],
    ["Phone 2", property.contact_phone_2],
    ["Email", property.contact_email],
    ["Opportunity", property.opportunity_type],
    ["Property type", property.property_type],
    ["Sub-type", property.property_subtype],
    ["Purpose", property.purpose],
    ["Status", property.status],
    ["City", property.city],
    ["Address", property.address],
    [
      "Coordinates",
      coord?.lat != null && coord?.lng != null
        ? `${coord.lat}, ${coord.lng}`
        : null,
    ],
    ["Land (perch)", property.land_size_perch],
    ["Floor area (sqft)", property.floor_area_sqft],
    ["Bedrooms", property.bedrooms],
    ["Bathrooms", property.bathrooms],
    ["Floors", property.number_of_floors],
    ["Parking", property.parking_spaces],
    ["Age (years)", property.age_years],
    ["Apartment complex", complex?.name],
    ["Apartment floor", property.apartment_floor],
    ["View", property.view],
    ["Suitable for", attrs.suitable_for],
    ["Built-up area", attrs.built_up_area],
    ["Currency", property.currency],
    ["Price per perch", property.price_per_perch],
    ["Price per sqft", property.price_per_sqft],
    [
      "Price total",
      property.price_total != null
        ? `${property.currency} ${property.price_total}`
        : null,
    ],
    ["Budget", property.budget],
    ["Furnished", property.furnished],
    ["Do not publish", property.do_not_publish ? "Yes" : "No"],
    ["Amenities", amenities.length ? amenities.join(", ") : null],
    ["Created by", property.created_by_name],
    ["Created", property.created_at],
    ["Updated", property.updated_at],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <div>
        <Link
          href="/app/properties"
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← Properties
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-semibold text-[var(--brand-deep)]">
              {property.ref_no}
            </h1>
            <p className="mt-1 text-[var(--muted)]">
              {property.property_type} · {property.opportunity_type} ·{" "}
              {property.status}
            </p>
          </div>
          {canEdit ? (
            <Link
              href={`/app/properties/${property.ref_no}/edit`}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
            >
              Edit listing
            </Link>
          ) : null}
        </div>

        <dl className="mt-8 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {label}
              </dt>
              <dd className="mt-1 text-sm">{display(value)}</dd>
            </div>
          ))}
        </dl>

        {property.comments ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="font-display text-lg font-semibold">Comments</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {property.comments}
            </p>
          </div>
        ) : null}
      </div>

      <aside className="space-y-6">
        {canChangeStatus ? (
          <form
            action={updatePropertyStatus}
            className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
          >
            <h2 className="font-display text-lg font-semibold">Update status</h2>
            <input type="hidden" name="ref_no" value={property.ref_no} />
            <select
              name="action"
              required
              className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
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
              rows={3}
              placeholder="Comment"
              className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-full bg-[var(--brand)] py-2.5 text-sm font-semibold text-white"
            >
              Submit
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
            Only the listing owner or an Admin can change status.
          </div>
        )}

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-display text-lg font-semibold">Recent activity</h2>
          <ul className="mt-3 space-y-3">
            {(events ?? []).map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--line)] pb-3 text-sm last:border-0"
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
            {!events?.length ? (
              <li className="text-sm text-[var(--muted)]">No events yet.</li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}
