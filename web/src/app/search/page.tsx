import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LiveFilterForm } from "@/components/live-filter-form";
import { PAGE_SIZE } from "@/lib/constants";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCard } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function PublicSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const propertyType = one(sp.property_type);
  const city = one(sp.city).trim();
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const options = await loadFormOptions();
  let query = supabase
    .from("property_public_cards")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (propertyType) query = query.eq("property_type", propertyType);
  if (city) query = query.ilike("city", `%${city}%`);
  if (q) query = query.or(`ref_no.ilike.%${q}%,city.ilike.%${q}%`);

  const { data, count, error } = await query;

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (propertyType) params.set("property_type", propertyType);
    if (city) params.set("city", city);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/search?${s}` : "/search";
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 font-display text-xl font-semibold text-[var(--brand-deep)] sm:text-2xl">
          <BrandLogo size={36} />
          Central7 Pulse
        </Link>
        <Link href="/login" className="-mr-2 shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-[var(--brand)]">
          Staff login
        </Link>
      </div>
      <h1 className="mt-6 font-display text-3xl font-semibold sm:mt-8 sm:text-4xl">Search listings</h1>

      <LiveFilterForm action="/search" className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:mt-6 md:grid-cols-3">
        <input name="q" defaultValue={q} placeholder="Ref or keyword" className="col-span-2 min-w-0 rounded-xl border border-[var(--line)] px-3 py-2 text-sm md:col-span-1" />
        <select name="property_type" defaultValue={propertyType} className="min-w-0 rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
          <option value="">All types</option>
          {options.propertyTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input name="city" defaultValue={city} placeholder="City" className="min-w-0 rounded-xl border border-[var(--line)] px-3 py-2 text-sm" />
      </LiveFilterForm>

      {error ? (
        <p className="mt-6 text-[var(--danger)]">{error.message}</p>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">{(count ?? 0).toLocaleString()} results</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {((data ?? []) as PropertyCard[]).map((r) => (
          <Link
            key={r.id}
            href={`/p/${r.ref_no}`}
            className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 transition hover:border-[var(--brand)]"
          >
            <p className="font-semibold text-[var(--brand-deep)]">{r.ref_no}</p>
            <p className="text-sm text-[var(--muted)]">
              {r.property_type} · {r.city || "—"}
            </p>
            <p className="mt-2 text-sm">
              {r.price_total != null
                ? `${r.currency} ${Number(r.price_total).toLocaleString()}`
                : "Price on request"}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <Link href={page > 1 ? pageHref(page - 1) : "#"} className={`-ml-2 rounded-lg px-2 py-2 ${page <= 1 ? "opacity-40" : ""}`}>
          ← Previous
        </Link>
        <Link href={pageHref(page + 1)} className="-mr-2 rounded-lg px-2 py-2">
          Next →
        </Link>
      </div>
    </main>
  );
}
