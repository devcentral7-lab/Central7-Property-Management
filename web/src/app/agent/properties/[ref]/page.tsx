import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicPropertyPhotos } from "@/app/p/[ref]/public-property-photos";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function AgentPropertyPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const refNo = decodeURIComponent(ref).toUpperCase();
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_public_cards")
    .select(
      "ref_no, property_type, opportunity_type, city, address, currency, price_total, bedrooms, bathrooms, land_size_perch, floor_area_sqft, view, amenities, comments",
    )
    .eq("ref_no", refNo)
    .maybeSingle();

  if (!data) notFound();

  const amenities = (data.amenities ?? []) as string[];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/agent"
        className="-ml-2 inline-block rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← Search properties
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl font-semibold text-[var(--brand-deep)] sm:text-3xl">
            {data.ref_no}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {data.property_type} · {data.opportunity_type} · {data.city || "—"}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Active listing
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:mt-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6">
            <h2 className="font-display text-base font-semibold">Property Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Fact label="Type" value={data.property_type} />
              <Fact label="Opportunity" value={data.opportunity_type} />
              <Fact label="City" value={data.city} />
              <Fact
                label="Beds / Baths"
                value={`${data.bedrooms ?? "—"} / ${data.bathrooms ?? "—"}`}
              />
              <Fact
                label="Land"
                value={data.land_size_perch != null ? `${data.land_size_perch} perch` : null}
              />
              <Fact
                label="Floor area"
                value={
                  data.floor_area_sqft != null
                    ? `${Number(data.floor_area_sqft).toLocaleString()} sqft`
                    : null
                }
              />
              <div className="col-span-2 sm:col-span-3">
                <Fact label="Address" value={data.address} />
              </div>
              {data.view ? (
                <div className="col-span-2 sm:col-span-3">
                  <Fact label="View" value={data.view} />
                </div>
              ) : null}
            </dl>
          </section>

          {amenities.length ? (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6">
              <h2 className="font-display text-base font-semibold">Amenities</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <li
                    key={a}
                    className="rounded-full border border-[var(--line)] bg-[var(--bg-accent)]/60 px-3 py-1 text-xs font-medium"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.comments ? (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6">
              <h2 className="font-display text-base font-semibold">Description</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
                {data.comments}
              </p>
            </section>
          ) : null}

          <PublicPropertyPhotos refNo={data.ref_no} />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
            <div className="bg-[var(--sidebar)] px-5 py-4 text-white">
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                {data.opportunity_type === "Rent Out" ? "Rent" : "Asking price"}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {data.price_total != null
                  ? `${data.currency} ${Number(data.price_total).toLocaleString()}`
                  : "Price on request"}
              </p>
            </div>
            <p className="px-5 py-4 text-sm text-[var(--muted)]">
              Quote reference <span className="font-semibold text-[var(--ink)]">{data.ref_no}</span>{" "}
              when you contact Central 7 about this property.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
