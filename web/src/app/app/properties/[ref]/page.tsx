import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePropertyStatus } from "@/app/app/actions";
import { STATUS_CHANGE_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const refNo = decodeURIComponent(ref).toUpperCase();
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("ref_no", refNo)
    .maybeSingle();

  if (error || !property) notFound();

  const { data: events } = await supabase
    .from("property_status_events")
    .select("id, occurred_at, actor_name, action, comment, assigned_to, requested_platforms")
    .eq("ref_no", refNo)
    .is("archived_at", null)
    .order("occurred_at", { ascending: false })
    .limit(20);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <div>
        <Link href="/app/properties" className="text-sm text-[var(--muted)] hover:underline">
          ← Properties
        </Link>
        <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--brand-deep)]">
          {property.ref_no}
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          {property.property_type} · {property.opportunity_type} · {property.status}
        </p>

        <dl className="mt-8 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 sm:grid-cols-2">
          {[
            ["Contact", property.contact_name],
            ["Phone", property.contact_phone_1],
            ["City", property.city],
            ["Address", property.address],
            ["Land (perch)", property.land_size_perch],
            ["Floor area", property.floor_area_sqft],
            ["Beds / Baths", `${property.bedrooms ?? "—"} / ${property.bathrooms ?? "—"}`],
            ["Parking", property.parking_spaces],
            ["View", property.view],
            ["Price total", property.price_total ? `${property.currency} ${property.price_total}` : null],
            ["Agent", property.created_by_name],
            ["Amenities", (property.amenities || []).join(", ")],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {label}
              </dt>
              <dd className="mt-1 text-sm">{value || "—"}</dd>
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
            {STATUS_CHANGE_OPTIONS.map((o) => (
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

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-display text-lg font-semibold">Recent activity</h2>
          <ul className="mt-3 space-y-3">
            {(events ?? []).map((e) => (
              <li key={e.id} className="border-b border-[var(--line)] pb-3 text-sm last:border-0">
                <p className="font-semibold">{e.action}</p>
                <p className="text-xs text-[var(--muted)]">
                  {e.actor_name || "—"}
                  {e.assigned_to ? ` → ${e.assigned_to}` : ""}
                </p>
                {e.comment ? <p className="mt-1 text-[var(--muted)]">{e.comment}</p> : null}
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
