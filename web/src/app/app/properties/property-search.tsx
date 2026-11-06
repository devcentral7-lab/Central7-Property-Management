import { Pager } from "@/components/pager";
import { PAGE_SIZE } from "@/lib/constants";
import { loadFormOptions } from "@/lib/form-options";
import {
  appendSearchFilters,
  applySearchFilters,
  hasSearchFilters,
  type SearchFilterValues,
} from "@/lib/property-search-filters";
import { createClient } from "@/lib/supabase/server";
import { bedsBaths, bedsBathsShort } from "@/lib/property-details";
import { ExportExcelButton } from "@/app/app/properties/export-excel-button";
import { PropertySearchForm } from "@/app/app/properties/property-search-form";
import { StatusBadge } from "@/components/status-badge";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

function complexName(v: unknown): string | null {
  const c = (Array.isArray(v) ? v[0] : v) as { name?: string | null } | null;
  return c?.name ?? null;
}

type Props = {
  filters: SearchFilterValues;
  page: number;
  isAdmin?: boolean;
};

export async function PropertySearchPanel({ filters, page, isAdmin = false }: Props) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const [options, { data: complexData }, { data: creatorData }] = await Promise.all([
    loadFormOptions(),
    supabase.from("apartment_complexes").select("id, name").order("name"),
    supabase.rpc("property_creator_names"),
  ]);
  const complexes = (complexData ?? []) as { id: string; name: string }[];
  const creators = (creatorData ?? []) as string[];

  const { data, count, error } = await applySearchFilters(
    supabase
      .from("properties")
      .select(
        "id, ref_no, created_at, created_by_name, opportunity_type, property_type, city, address, status, currency, price_total, bedrooms, bathrooms, land_size_perch, floor_area_sqft, apartment_complexes(name)",
        { count: "exact" },
      ),
    filters,
  )
    .order("created_at", { ascending: false })
    .range(from, to);

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
  const filtered = hasSearchFilters(filters);

  const exportParams = new URLSearchParams();
  exportParams.set("scope", "search");
  appendSearchFilters(exportParams, filters);

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    appendSearchFilters(params, filters);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/app/properties?${s}` : "/app/properties";
  }

  return (
    <div className="space-y-4">
      <PropertySearchForm options={options} filters={filters} complexes={complexes} creators={creators} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          {total.toLocaleString()} filtered matches · page {page} of {totalPages}{" "}
          · {PAGE_SIZE} per page
        </p>
        {isAdmin ? (
          <ExportExcelButton
            query={exportParams.toString()}
            filtered={filtered}
            disabled={!total}
          />
        ) : null}
      </div>

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
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
            <tr>
              <th className="px-4 py-3 font-bold">Ref</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">City</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Beds / Baths</th>
              <th className="px-4 py-3 font-bold">Price</th>
              <th className="px-4 py-3 font-bold">Agent</th>
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

      <Pager page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
