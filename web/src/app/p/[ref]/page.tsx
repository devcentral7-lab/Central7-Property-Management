import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicPropertyPhotos } from "@/app/p/[ref]/public-property-photos";

export default async function PublicPropertyPage({
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
      "ref_no, property_type, opportunity_type, city, address, status, currency, price_total, bedrooms, bathrooms, land_size_perch, floor_area_sqft, view, amenities, comments",
    )
    .eq("ref_no", refNo)
    .maybeSingle();

  if (!data) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
      <Link href="/search" className="-ml-2 inline-block rounded-lg px-2 py-2 text-sm text-[var(--muted)] hover:underline">
        ← Search
      </Link>
      <h1 className="mt-2 break-words font-display text-3xl font-semibold text-[var(--brand-deep)] sm:mt-4 sm:text-4xl">
        {data.ref_no}
      </h1>
      <p className="mt-1 text-[var(--muted)]">
        {data.property_type} · {data.opportunity_type} · {data.city || "—"}
      </p>
      <PublicPropertyPhotos refNo={data.ref_no} />
      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:mt-8 sm:p-6">
        {[
          ["Address", data.address],
          ["Land", data.land_size_perch],
          ["Floor area", data.floor_area_sqft],
          ["Beds / Baths", `${data.bedrooms ?? "—"} / ${data.bathrooms ?? "—"}`],
          ["View", data.view],
          [
            "Price",
            data.price_total != null
              ? `${data.currency} ${Number(data.price_total).toLocaleString()}`
              : null,
          ],
          ["Amenities", (data.amenities || []).join(", ")],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className={`min-w-0 ${label === "Address" || label === "Amenities" ? "col-span-2" : ""}`}
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {data.comments ? (
        <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
          {data.comments}
        </p>
      ) : null}
    </main>
  );
}
