"use client";

import { useMemo, useState, useTransition } from "react";
import { RangeFilter } from "@/components/range-filter";
import { LiveFilterForm } from "@/components/live-filter-form";
import { searchPropertiesByParagraph } from "@/app/app/properties/search-actions";
import { StatusBadge } from "@/components/status-badge";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";
import type { FormOptions } from "@/lib/form-options";
import type { ScoredProperty } from "@/lib/property-match";

const inputClass =
  "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm";

export type SearchFilterValues = {
  q: string;
  status: string;
  opportunity_type: string;
  property_type: string;
  complex: string;
  contact_type: string;
  city: string;
  furnished: string;
  currency: string;
  view: string;
  bedrooms_min: string;
  bedrooms_max: string;
  bathrooms_min: string;
  bathrooms_max: string;
  land_min: string;
  land_max: string;
  floor_min: string;
  floor_max: string;
  price_min: string;
  price_max: string;
  budget_min: string;
  budget_max: string;
  parking_min: string;
  do_not_publish: string;
  advanced: string;
};

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

type Props = {
  options: FormOptions;
  filters: SearchFilterValues;
  complexes: { id: string; name: string }[];
};

export function PropertySearchForm({ options, filters, complexes }: Props) {
  const hasAdvanced = useMemo(() => {
    const keys: (keyof SearchFilterValues)[] = [
      "opportunity_type",
      "contact_type",
      "furnished",
      "currency",
      "view",
      "bedrooms_min",
      "bedrooms_max",
      "bathrooms_min",
      "bathrooms_max",
      "land_min",
      "land_max",
      "floor_min",
      "floor_max",
      "price_min",
      "price_max",
      "budget_min",
      "budget_max",
      "parking_min",
      "do_not_publish",
    ];
    return keys.some((k) => Boolean(filters[k])) || filters.advanced === "1";
  }, [filters]);

  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);
  const [paragraph, setParagraph] = useState("");
  const [pending, startTransition] = useTransition();
  const [paraError, setParaError] = useState<string | null>(null);
  const [paraResults, setParaResults] = useState<ScoredProperty[] | null>(null);
  const [usedCriteria, setUsedCriteria] = useState<Record<string, string> | null>(
    null,
  );

  function runParagraphSearch() {
    setParaError(null);
    startTransition(async () => {
      const result = await searchPropertiesByParagraph(paragraph);
      if (!result.ok) {
        setParaResults(null);
        setUsedCriteria(null);
        setParaError(result.error);
        return;
      }
      setUsedCriteria(result.criteria);
      setParaResults(result.results);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            Paragraph Search
          </h2>
          <button
            type="button"
            onClick={runParagraphSearch}
            disabled={pending || !paragraph.trim()}
            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
          >
            {pending ? "Matching…" : "Find matches"}
          </button>
        </div>
        <textarea
          value={paragraph}
          onChange={(e) => setParagraph(e.target.value)}
          rows={3}
          placeholder="Paste a property description — results are ranked by match %"
          className={`${inputClass} mt-2`}
        />
        {paraError ? (
          <p className="mt-2 text-sm text-[var(--danger)]">{paraError}</p>
        ) : null}
        {usedCriteria ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Matched on:{" "}
            {Object.entries(usedCriteria)
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </p>
        ) : null}
      </section>

      <LiveFilterForm
        action="/app/properties"
        className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
      >
        {showAdvanced ? <input type="hidden" name="advanced" value="1" /> : null}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <label className="col-span-2 text-sm font-medium">
            Quick search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Ref, contact, address, city…"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select
              name="status"
              defaultValue={filters.status}
              className={`${inputClass} mt-1`}
            >
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
            City
            <input
              name="city"
              defaultValue={filters.city}
              placeholder="City"
              className={`${inputClass} mt-1`}
            />
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
          <label className="col-span-2 text-sm font-medium">
            Apartment complex
            <select
              name="complex"
              defaultValue={filters.complex}
              className={`${inputClass} mt-1`}
            >
              <option value="">All complexes</option>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm font-semibold text-[var(--brand-deep)] hover:underline"
          >
            {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
          </button>
          <button
            type="reset"
            className="ml-auto rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
          >
            Clear
          </button>
        </div>

        {showAdvanced ? (
          <div className="mt-4 space-y-5 border-t border-[var(--line)] pt-4">
            <div className="grid grid-cols-2 items-start gap-3 xl:grid-cols-3">
              <label className="text-sm font-medium">
                Contact Type
                <select
                  name="contact_type"
                  defaultValue={filters.contact_type}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">All</option>
                  {options.contactTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Furnished
                <select
                  name="furnished"
                  defaultValue={filters.furnished}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">All</option>
                  {options.furnished.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
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
                View
                <input
                  name="view"
                  defaultValue={filters.view}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-sm font-medium">
                Do Not Publish
                <select
                  name="do_not_publish"
                  defaultValue={filters.do_not_publish}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Any</option>
                  <option value="false">Publishable only</option>
                  <option value="true">Do not publish only</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Parking Min
                <input
                  name="parking_min"
                  defaultValue={filters.parking_min}
                  inputMode="decimal"
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4 xl:grid-cols-6">
              <RangeFilter
                label="Beds"
                minName="bedrooms_min"
                maxName="bedrooms_max"
                defaultMin={filters.bedrooms_min}
                defaultMax={filters.bedrooms_max}
                ceiling={20}
                step={1}
                inputClassName={inputClass}
              />
              <RangeFilter
                label="Baths"
                minName="bathrooms_min"
                maxName="bathrooms_max"
                defaultMin={filters.bathrooms_min}
                defaultMax={filters.bathrooms_max}
                ceiling={20}
                step={1}
                inputClassName={inputClass}
              />
              <RangeFilter
                label="Land (Perches)"
                minName="land_min"
                maxName="land_max"
                defaultMin={filters.land_min}
                defaultMax={filters.land_max}
                ceiling={1000}
                step={0.5}
                inputClassName={inputClass}
              />
              <RangeFilter
                label="Floor Area (Sqft)"
                minName="floor_min"
                maxName="floor_max"
                defaultMin={filters.floor_min}
                defaultMax={filters.floor_max}
                ceiling={50000}
                step={100}
                inputClassName={inputClass}
              />
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
              <RangeFilter
                label="Budget"
                minName="budget_min"
                maxName="budget_max"
                defaultMin={filters.budget_min}
                defaultMax={filters.budget_max}
                ceiling={filters.currency === "USD" ? 1000000 : 100000000}
                step={1000}
                money
                inputClassName={inputClass}
              />
            </div>
          </div>
        ) : null}
      </LiveFilterForm>

      {paraResults ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-accent)]/50 px-4 py-3">
            <p className="font-display text-base font-semibold">
              {paraResults.length} ranked match
              {paraResults.length === 1 ? "" : "es"}
            </p>
            <button
              type="button"
              onClick={() => {
                setParaResults(null);
                setUsedCriteria(null);
              }}
              className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--bg-accent)] transition"
            >
              Clear matches
            </button>
          </div>
          <ul className="divide-y divide-[var(--line)] md:hidden">
            {paraResults.map((r) => (
              <PropertyRow key={r.id} refNo={r.ref_no} as="li" className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--brand-deep)]">
                    {r.match_percent}%
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  {r.property_type} · {r.opportunity_type} · {r.city || "—"}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">
                    {formatMoney(r.price_total, r.currency || "LKR")}
                  </span>
                  <span className="text-[var(--muted)]"> · </span>
                  <StatusBadge status={r.status} className="text-xs" />
                </p>
                {r.match_hits.length ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {r.match_hits.slice(0, 4).join(", ")}
                  </p>
                ) : null}
              </PropertyRow>
            ))}
            {!paraResults.length ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                No matching properties found.
              </li>
            ) : null}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Match</th>
                  <th className="px-4 py-2 font-medium">Ref</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Hits</th>
                </tr>
              </thead>
              <tbody>
                {paraResults.map((r) => (
                  <PropertyRow
                    key={r.id}
                    refNo={r.ref_no}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="px-4 py-2 font-semibold tabular-nums text-[var(--brand-deep)]">
                      {r.match_percent}%
                    </td>
                    <td className="px-4 py-2">
                      <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
                    </td>
                    <td className="px-4 py-2">
                      {r.property_type}
                      <span className="block text-xs text-[var(--muted)]">
                        {r.opportunity_type}
                      </span>
                    </td>
                    <td className="px-4 py-2">{r.city || "—"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2">
                      {formatMoney(r.price_total, r.currency || "LKR")}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {r.match_hits.slice(0, 4).join(", ") || "—"}
                    </td>
                  </PropertyRow>
                ))}
                {!paraResults.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-[var(--muted)]"
                    >
                      No matching properties found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
