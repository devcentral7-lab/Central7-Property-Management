import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <Link href="/search" className="text-sm text-[var(--muted)] hover:underline">
        ← Search
      </Link>
      <h1 className="mt-4 font-display text-4xl font-semibold text-[var(--brand-deep)]">
        {data.ref_no}
      </h1>
      <p className="mt-1 text-[var(--muted)]">
        {data.property_type} · {data.opportunity_type} · {data.city || "—"}
      </p>
      <dl className="mt-8 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 sm:grid-cols-2">
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
          <div key={String(label)}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {label}
            </dt>
            <dd className="mt-1 text-sm">{value || "—"}</dd>
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
