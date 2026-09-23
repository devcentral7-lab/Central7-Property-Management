"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { searchPropertiesByParagraph } from "@/app/app/properties/search-actions";
import { PropertyLink } from "@/app/app/properties/property-modal";
import type { FormOptions } from "@/lib/form-options";
import type { ScoredProperty } from "@/lib/property-match";

const inputClass =
  "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm";

export type SearchFilterValues = {
  q: string;
  status: string;
  opportunity_type: string;
  property_type: string;
  property_subtype: string;
  contact_type: string;
  city: string;
  furnished: string;
  currency: string;
  agent: string;
  purpose: string;
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
  floors_min: string;
  floors_max: string;
  age_max: string;
  do_not_publish: string;
  amenities: string;
  advanced: string;
};

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

type Props = {
  options: FormOptions;
  filters: SearchFilterValues;
};

export function PropertySearchForm({ options, filters }: Props) {
  const hasAdvanced = useMemo(() => {
    const keys: (keyof SearchFilterValues)[] = [
      "opportunity_type",
      "property_subtype",
      "contact_type",
      "furnished",
      "currency",
      "agent",
      "purpose",
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
      "floors_min",
      "floors_max",
      "age_max",
      "do_not_publish",
      "amenities",
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
      <form
        method="get"
        action="/app/properties"
        className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
      >
        {showAdvanced ? <input type="hidden" name="advanced" value="1" /> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium xl:col-span-2">
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
            type="submit"
            className="ml-auto rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
          >
            Apply filters
          </button>
          <Link
            href="/app/properties"
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
          >
            Clear
          </Link>
        </div>

        {showAdvanced ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium">
              Sub-type
              <input
                name="property_subtype"
                defaultValue={filters.property_subtype}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Contact type
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
              Agent / created by
              <input
                name="agent"
                defaultValue={filters.agent}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Purpose
              <input
                name="purpose"
                defaultValue={filters.purpose}
                className={`${inputClass} mt-1`}
              />
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
              Do not publish
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
              Beds min
              <input
                name="bedrooms_min"
                defaultValue={filters.bedrooms_min}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Beds max
              <input
                name="bedrooms_max"
                defaultValue={filters.bedrooms_max}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Baths min
              <input
                name="bathrooms_min"
                defaultValue={filters.bathrooms_min}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Baths max
              <input
                name="bathrooms_max"
                defaultValue={filters.bathrooms_max}
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
            <label className="text-sm font-medium">
              Floor area min
              <input
                name="floor_min"
                defaultValue={filters.floor_min}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Floor area max
              <input
                name="floor_max"
                defaultValue={filters.floor_max}
                inputMode="decimal"
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
              Budget min
              <input
                name="budget_min"
                defaultValue={filters.budget_min}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Budget max
              <input
                name="budget_max"
                defaultValue={filters.budget_max}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Parking min
              <input
                name="parking_min"
                defaultValue={filters.parking_min}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Floors min
              <input
                name="floors_min"
                defaultValue={filters.floors_min}
                inputMode="numeric"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Floors max
              <input
                name="floors_max"
                defaultValue={filters.floors_max}
                inputMode="numeric"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium">
              Age max (years)
              <input
                name="age_max"
                defaultValue={filters.age_max}
                inputMode="decimal"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium md:col-span-2 xl:col-span-4">
              Amenities contain
              <input
                name="amenities"
                defaultValue={filters.amenities}
                placeholder="e.g. Pool, CCTV"
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
        ) : null}
      </form>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            Paragraph search
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

        {paraResults ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-accent)]/50 px-4 py-2">
              <p className="text-sm font-medium">
                {paraResults.length} ranked match
                {paraResults.length === 1 ? "" : "es"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setParaResults(null);
                  setUsedCriteria(null);
                }}
                className="text-xs font-semibold text-[var(--muted)] hover:underline"
              >
                Clear matches
              </button>
            </div>
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
                  <tr
                    key={r.id}
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
                    <td className="px-4 py-2">{r.status}</td>
                    <td className="px-4 py-2">
                      {formatMoney(r.price_total, r.currency || "LKR")}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {r.match_hits.slice(0, 4).join(", ") || "—"}
                    </td>
                  </tr>
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
        ) : null}
      </section>
    </div>
  );
}
