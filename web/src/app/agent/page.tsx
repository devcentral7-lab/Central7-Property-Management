import Link from "next/link";
import { LiveFilterForm } from "@/components/live-filter-form";
import { PAGE_SIZE } from "@/lib/constants";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm";

const ADVANCED_KEYS = [
  "currency",
  "bedrooms_min",
  "bathrooms_min",
  "price_min",
  "price_max",
  "land_min",
  "land_max",
] as const;

const FILTER_KEYS = [
  "q",
  "property_type",
  "opportunity_type",
  "city",
  ...ADVANCED_KEYS,
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;

type PublicCard = {
  id: string;
  ref_no: string;
  opportunity_type: string;
  property_type: string;
  city: string | null;
  address: string | null;
  currency: string;
  price_total: number | null;
  land_size_perch: number | null;
  floor_area_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

function numOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n: number | null, currency: string) {
  return n == null ? "Price on request" : `${currency} ${Number(n).toLocaleString()}`;
}

function sizeLabel(r: PublicCard) {
  const parts = [
    r.land_size_perch != null ? `${r.land_size_perch} perch` : null,
    r.floor_area_sqft != null ? `${Number(r.floor_area_sqft).toLocaleString()} sqft` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default async function AgentSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = Object.fromEntries(
    FILTER_KEYS.map((k) => [k, one(sp[k]).trim()]),
  ) as Filters;
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const options = await loadFormOptions();
  let query = supabase
    .from("property_public_cards")
    .select(
      "id, ref_no, opportunity_type, property_type, city, address, currency, price_total, land_size_perch, floor_area_sqft, bedrooms, bathrooms",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.property_type) query = query.eq("property_type", filters.property_type);
  if (filters.opportunity_type) {
    query = query.eq("opportunity_type", filters.opportunity_type);
  }
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.q) {
    const q = filters.q.replace(/[%_,()]/g, " ");
    query = query.or(`ref_no.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`);
  }

  const bedsMin = numOrNull(filters.bedrooms_min);
  const bathsMin = numOrNull(filters.bathrooms_min);
  const priceMin = numOrNull(filters.price_min);
  const priceMax = numOrNull(filters.price_max);
  const landMin = numOrNull(filters.land_min);
  const landMax = numOrNull(filters.land_max);
  if (bedsMin != null) query = query.gte("bedrooms", bedsMin);
  if (bathsMin != null) query = query.gte("bathrooms", bathsMin);
  if (priceMin != null) query = query.gte("price_total", priceMin);
  if (priceMax != null) query = query.lte("price_total", priceMax);
  if (landMin != null) query = query.gte("land_size_perch", landMin);
  if (landMax != null) query = query.lte("land_size_perch", landMax);

  const { data, count, error } = await query;
  const rows = (data ?? []) as PublicCard[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showAdvanced = ADVANCED_KEYS.some((k) => Boolean(filters[k]));

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const k of FILTER_KEYS) if (filters[k]) params.set(k, filters[k]);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/agent?${s}` : "/agent";
  }

  const detailHref = (ref: string) => `/agent/properties/${encodeURIComponent(ref)}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Search properties</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Browse every active Central 7 listing by keyword, location, type or price.
      </p>

      <div className="mt-5 space-y-4 sm:mt-6">
        <LiveFilterForm
          action="/agent"
          className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <label className="col-span-2 text-sm font-medium">
              Quick search
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Ref, city, address…"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Property type
              <select
                name="property_type"
                defaultValue={filters.property_type}
                className={`${inputClass} mt-1`}
              >
                <option value="">All types</option>
                {options.propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Opportunity
              <select
                name="opportunity_type"
                defaultValue={filters.opportunity_type}
                className={`${inputClass} mt-1`}
              >
                <option value="">All</option>
                {options.opportunityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-sm font-medium xl:col-span-1">
              City
              <input
                name="city"
                defaultValue={filters.city}
                placeholder="City"
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>

          <details open={showAdvanced} className="group mt-3">
            <summary className="inline-block cursor-pointer list-none text-sm font-semibold text-[var(--brand-deep)] hover:underline [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show advanced filters</span>
              <span className="hidden group-open:inline">Hide advanced filters</span>
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 xl:grid-cols-4">
              <label className="text-sm font-medium">
                Currency
                <select
                  name="currency"
                  defaultValue={filters.currency}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">All</option>
                  {options.currencies.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Beds min
                <input
                  name="bedrooms_min"
                  defaultValue={filters.bedrooms_min}
                  inputMode="numeric"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-sm font-medium">
                Baths min
                <input
                  name="bathrooms_min"
                  defaultValue={filters.bathrooms_min}
                  inputMode="numeric"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-sm font-medium">
                Price min
                <input
                  name="price_min"
                  defaultValue={filters.price_min}
                  inputMode="decimal"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-sm font-medium">
                Price max
                <input
                  name="price_max"
                  defaultValue={filters.price_max}
                  inputMode="decimal"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-sm font-medium">
                Land min (perch)
                <input
                  name="land_min"
                  defaultValue={filters.land_min}
                  inputMode="decimal"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-sm font-medium">
                Land max (perch)
                <input
                  name="land_max"
                  defaultValue={filters.land_max}
                  inputMode="decimal"
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
          </details>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button
              type="reset"
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
            >
              Clear
            </button>
          </div>
        </LiveFilterForm>

        {error ? (
          <p className="rounded-xl bg-red-50 p-4 text-[var(--danger)]">{error.message}</p>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">
              {total.toLocaleString()} matches · page {page} of {totalPages} · {PAGE_SIZE} per
              page
            </p>

            <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={detailHref(r.ref_no)}
                    className="block px-4 py-3 transition hover:bg-[var(--bg-accent)]/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-[var(--brand-deep)]">{r.ref_no}</span>
                      <span className="shrink-0 rounded-full bg-[var(--bg-accent)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                        {r.opportunity_type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      {r.property_type} · {r.city || "—"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="font-semibold">{formatMoney(r.price_total, r.currency)}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {r.bedrooms ?? "—"} bd / {r.bathrooms ?? "—"} ba
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
              {!rows.length ? (
                <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No properties match these filters.
                </li>
              ) : null}
            </ul>

            <div className="hidden overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ref</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">Beds / Baths</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3" aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--line)] transition last:border-0 hover:bg-[var(--bg-accent)]/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref(r.ref_no)}
                          className="font-semibold text-[var(--brand-deep)] hover:underline"
                        >
                          {r.ref_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.property_type}
                        <span className="block text-xs text-[var(--muted)]">
                          {r.opportunity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.city || "—"}</td>
                      <td className="px-4 py-3">
                        {r.bedrooms ?? "—"} / {r.bathrooms ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{sizeLabel(r)}</td>
                      <td className="px-4 py-3 font-medium">
                        {formatMoney(r.price_total, r.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={detailHref(r.ref_no)}
                          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">
                        No properties match these filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Link
                href={hrefFor(Math.max(1, page - 1))}
                className={`-ml-2 rounded-lg px-2 py-2 text-sm font-medium ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
              >
                ← Previous
              </Link>
              <Link
                href={hrefFor(Math.min(totalPages, page + 1))}
                className={`-mr-2 rounded-lg px-2 py-2 text-sm font-medium ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
              >
                Next →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
