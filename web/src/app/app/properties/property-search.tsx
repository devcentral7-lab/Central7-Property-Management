import Link from "next/link";
import { splitListParam } from "@/lib/list-param";
import { PAGE_SIZE } from "@/lib/constants";
import { loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";
import { bedsBaths, bedsBathsShort } from "@/lib/property-details";
import {
  PropertySearchForm,
  type SearchFilterValues,
} from "@/app/app/properties/property-search-form";
import { StatusBadge } from "@/components/status-badge";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function complexName(v: unknown): string | null {
  const c = (Array.isArray(v) ? v[0] : v) as { name?: string | null } | null;
  return c?.name ?? null;
}

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  filters: SearchFilterValues;
  page: number;
};

export async function PropertySearchPanel({ filters, page }: Props) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const [options, { data: complexData }] = await Promise.all([
    loadFormOptions(),
    supabase.from("apartment_complexes").select("id, name").order("name"),
  ]);
  const complexes = (complexData ?? []) as { id: string; name: string }[];

  let query = supabase
    .from("properties")
    .select(
      "id, ref_no, created_at, created_by_name, opportunity_type, property_type, city, address, status, currency, price_total, bedrooms, bathrooms, land_size_perch, floor_area_sqft, apartment_complexes(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.property_type) {
    query = query.eq("property_type", filters.property_type);
  }
  const complexIds = splitListParam(filters.complex);
  if (complexIds.length) {
    const valid = complexIds.filter((id) => UUID_RE.test(id));
    query = valid.length
      ? query.in("apartment_complex_id", valid)
      : query.is("id", null);
  }
  if (filters.opportunity_type) {
    query = query.eq("opportunity_type", filters.opportunity_type);
  }
  if (filters.contact_type) {
    query = query.eq("contact_type", filters.contact_type);
  }
  if (filters.furnished) query = query.eq("furnished", filters.furnished);
  if (filters.currency) query = query.eq("currency", filters.currency);
  const cities = splitListParam(filters.city);
  if (cities.length === 1) {
    query = query.ilike("city", `%${cities[0]}%`);
  } else if (cities.length > 1) {
    query = query.or(
      cities.map((c) => `city.ilike."%${c.replace(/["\\]/g, "")}%"`).join(","),
    );
  }
  if (filters.view) query = query.ilike("view", `%${filters.view}%`);
  if (filters.do_not_publish === "true") {
    query = query.eq("do_not_publish", true);
  } else if (filters.do_not_publish === "false") {
    query = query.eq("do_not_publish", false);
  }

  const bedroomsMin = numOrNull(filters.bedrooms_min);
  const bedroomsMax = numOrNull(filters.bedrooms_max);
  const bathroomsMin = numOrNull(filters.bathrooms_min);
  const bathroomsMax = numOrNull(filters.bathrooms_max);
  const landMin = numOrNull(filters.land_min);
  const landMax = numOrNull(filters.land_max);
  const floorMin = numOrNull(filters.floor_min);
  const floorMax = numOrNull(filters.floor_max);
  const priceMin = numOrNull(filters.price_min);
  const priceMax = numOrNull(filters.price_max);
  const budgetMin = numOrNull(filters.budget_min);
  const budgetMax = numOrNull(filters.budget_max);
  const parkingMin = numOrNull(filters.parking_min);

  if (bedroomsMin != null) query = query.gte("bedrooms", bedroomsMin);
  if (bedroomsMax != null) query = query.lte("bedrooms", bedroomsMax);
  if (bathroomsMin != null) query = query.gte("bathrooms", bathroomsMin);
  if (bathroomsMax != null) query = query.lte("bathrooms", bathroomsMax);
  if (landMin != null) query = query.gte("land_size_perch", landMin);
  if (landMax != null) query = query.lte("land_size_perch", landMax);
  if (floorMin != null) query = query.gte("floor_area_sqft", floorMin);
  if (floorMax != null) query = query.lte("floor_area_sqft", floorMax);
  if (priceMin != null) query = query.gte("price_total", priceMin);
  if (priceMax != null) query = query.lte("price_total", priceMax);
  if (budgetMin != null) query = query.gte("budget", budgetMin);
  if (budgetMax != null) query = query.lte("budget", budgetMax);
  if (parkingMin != null) query = query.gte("parking_spaces", parkingMin);

  if (filters.q) {
    const q = filters.q.replace(/[%_,]/g, " ");
    query = query.or(
      `ref_no.ilike.%${q}%,contact_name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,contact_phone_1.ilike.%${q}%,comments.ilike.%${q}%,internal_comments.ilike.%${q}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-[var(--danger)]">
        {error.message}
      </p>
    );
  }

  const rows = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v || k === "status") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/app/properties?${s}` : "/app/properties";
  }

  return (
    <div className="space-y-4">
      <PropertySearchForm options={options} filters={filters} complexes={complexes} />

      <p className="text-sm text-[var(--muted)]">
        {total.toLocaleString()} filtered matches · page {page} of {totalPages}{" "}
        · {PAGE_SIZE} per page
      </p>

      <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] md:hidden">
        {rows.map((r) => (
          <PropertyRow key={r.id} refNo={r.ref_no} as="li" className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
              <StatusBadge status={r.status} className="shrink-0 text-xs" />
            </div>
            <p className="mt-1 text-sm">
              {r.property_type} · {r.opportunity_type} · {r.city || "—"}
            </p>
            {complexName(r.apartment_complexes) ? (
              <p className="text-xs text-[var(--muted)]">
                {complexName(r.apartment_complexes)}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">
                {formatMoney(r.price_total, r.currency)}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {[bedsBathsShort(r.bedrooms, r.bathrooms), r.created_by_name || "—"].filter(Boolean).join(" · ")}
              </span>
            </div>
          </PropertyRow>
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
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Beds / Baths</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Agent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PropertyRow
                key={r.id}
                refNo={r.ref_no}
                className="border-b border-[var(--line)] last:border-0"
              >
                <td className="px-4 py-3">
                  <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
                </td>
                <td className="px-4 py-3">
                  {r.property_type}
                  <span className="block text-xs text-[var(--muted)]">
                    {r.opportunity_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.city || "—"}
                  {complexName(r.apartment_complexes) ? (
                    <span className="block text-xs text-[var(--muted)]">
                      {complexName(r.apartment_complexes)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  {bedsBaths(r.bedrooms, r.bathrooms)}
                </td>
                <td className="px-4 py-3">
                  {formatMoney(r.price_total, r.currency)}
                </td>
                <td className="px-4 py-3">{r.created_by_name || "—"}</td>
              </PropertyRow>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
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
    </div>
  );
}
