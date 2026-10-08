import Link from "next/link";
import { PAGE_SIZE } from "@/lib/constants";
import { loadFormOptions } from "@/lib/form-options";
import {
  appendMineFilters,
  applyMineFilters,
  hasMineFilters,
  type MinePropertyFilters,
} from "@/lib/my-properties-filters";
import { createClient } from "@/lib/supabase/server";
import { bedsBaths, bedsBathsShort } from "@/lib/property-details";
import type { PropertyCard } from "@/lib/types";
import { RangeFilter } from "@/components/range-filter";
import { CitySelect } from "@/components/city-select";
import { LiveFilterForm } from "@/components/live-filter-form";
import { StatusBadge } from "@/components/status-badge";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";
import { ExportExcelButton } from "@/app/app/properties/export-excel-button";

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const inputClass = "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm";

type Props = {
  target: string;
  /** Signed-in user's display name; the staff picker resets to it. */
  selfName: string;
  page: number;
  isAdmin: boolean;
  filters: MinePropertyFilters;
  /** Standalone page instead of the Properties "mine" tab. */
  standalone?: boolean;
};

export async function PropertyMinePanel({
  target,
  selfName,
  page,
  isAdmin,
  filters,
  standalone = false,
}: Props) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const filtered = hasMineFilters(filters);

  const supabase = await createClient();
  const [options, { data, count, error }] = await Promise.all([
    loadFormOptions(),
    applyMineFilters(
      supabase
        .from("property_list_cards")
        .select("*", { count: "exact" })
        .eq("created_by_name", target),
      filters,
    )
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  if (error) {
    return <p className="text-[var(--danger)]">{error.message}</p>;
  }

  let staffNames: string[] = [];
  if (isAdmin) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("display_name")
      .order("display_name");
    staffNames = [
      ...new Set([
        ...(staff ?? []).map((s) => s.display_name as string).filter(Boolean),
        target,
        selfName,
      ]),
    ].sort((a, b) => a.localeCompare(b));
  }

  const rows = (data ?? []) as PropertyCard[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (isAdmin) exportParams.set("user", target);
  appendMineFilters(exportParams, filters);

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    if (!standalone) params.set("tab", "mine");
    if (p > 1) params.set("page", String(p));
    if (isAdmin) params.set("user", target);
    appendMineFilters(params, filters);
    const qs = params.toString();
    const base = standalone ? "/app/my-properties" : "/app/properties";
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div>
      <LiveFilterForm className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        {standalone ? null : <input type="hidden" name="tab" value="mine" />}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {isAdmin ? (
            <label className="col-span-2 text-sm font-medium xl:col-span-1">
              Staff member
              <select
                name="user"
                defaultValue={target}
                data-default-value={selfName}
                className={`${inputClass} mt-1`}
              >
                {staffNames.map((name) => (
                  <option key={name} value={name}>
                    {name === selfName ? `${name} (me)` : name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={`col-span-2 text-sm font-medium ${isAdmin ? "xl:col-span-1" : ""}`}>
            Quick search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Ref, contact, phone, address…"
              autoComplete="off"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select name="status" defaultValue={filters.status} data-default-value="Active" className={`${inputClass} mt-1`}>
              <option value="">All statuses</option>
              {options.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
          <CitySelect defaultValue={filters.city} className={inputClass} autoSubmit />
          <label className="text-sm font-medium">
            Added from
            <input
              type="date"
              name="added_from"
              defaultValue={filters.added_from}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm font-medium">
            Added to
            <input
              type="date"
              name="added_to"
              defaultValue={filters.added_to}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm font-medium">
            Currency
            <select
              name="currency"
              defaultValue={filters.currency}
              className={`${inputClass} mt-1`}
            >
              <option value="">All currencies</option>
              {options.currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Beds min
            <input
              name="bedrooms_min"
              defaultValue={filters.bedrooms_min}
              inputMode="decimal"
              className={`${inputClass} mt-1`}
            />
          </label>
          <div className="col-span-2 grid grid-cols-1 xl:col-span-4">
            <RangeFilter
              label="Price"
              minName="price_min"
              maxName="price_max"
              defaultMin={filters.price_min}
              defaultMax={filters.price_max}
              ceiling={filters.currency === "USD" ? 1000000 : 100000000}
              step={1000}
              money
              inputClassName={inputClass}
            />
          </div>
          <div className="col-span-2 flex items-end justify-end xl:col-span-4">
            <button
              type="reset"
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              Clear filters
            </button>
          </div>
        </div>
      </LiveFilterForm>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          Showing listings for <strong>{target}</strong> ·{" "}
          {total.toLocaleString()} {filtered ? "matching filters" : "total"} · page {page} of{" "}
          {totalPages}
        </p>
        <ExportExcelButton
          query={exportParams.toString()}
          filtered={filtered}
          disabled={!total}
        />
      </div>

      <ul className="mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] md:hidden">
        {rows.map((r) => (
          <PropertyRow key={r.id} refNo={r.ref_no} as="li" className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
              <StatusBadge status={r.status} className="shrink-0 text-xs" />
            </div>
            <p className="mt-1 text-sm">
              {r.property_type} · {r.opportunity_type} · {r.city || "—"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">
                {formatMoney(r.price_total, r.currency)}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {[bedsBathsShort(r.bedrooms, r.bathrooms), formatDate(r.created_at)].filter(Boolean).join(" · ")}
              </span>
            </div>
          </PropertyRow>
        ))}
        {!rows.length ? (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            {filtered ? "No listings match these filters." : "No listings."}
          </li>
        ) : null}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Beds / Baths</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Added</th>
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
                <td className="px-4 py-3">{r.city || "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  {bedsBaths(r.bedrooms, r.bathrooms)}
                </td>
                <td className="px-4 py-3">
                  {formatMoney(r.price_total, r.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                  {formatDate(r.created_at)}
                </td>
              </PropertyRow>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  {filtered ? "No listings match these filters." : "No listings."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
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
