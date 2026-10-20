"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RangeFilter } from "@/components/range-filter";
import { useCities } from "@/components/cities-context";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { LiveFilterForm, clearFilterGroup } from "@/components/live-filter-form";
import { searchPropertiesByParagraph } from "@/app/app/properties/search-actions";
import type { FormOptions } from "@/lib/form-options";
import { SOCIAL_FILTERS } from "@/lib/social-filters";

const inputClass =
  "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm";

const PRICE_CEILING = 1_000_000_000;
const PRICE_STEP = 1_000_000;

export type SearchFilterValues = {
  q: string;
  status: string;
  opportunity_type: string;
  property_type: string;
  complex: string;
  added_by: string;
  contact: string;
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
  social: string;
  advanced: string;
};

type Props = {
  options: FormOptions;
  filters: SearchFilterValues;
  complexes: { id: string; name: string }[];
  creators?: string[];
};

export function PropertySearchForm({ options, filters, complexes, creators = [] }: Props) {
  const router = useRouter();
  const cities = useCities();
  const cityOptions = useMemo(() => cities.map((c) => ({ value: c, label: c })), [cities]);
  const complexOptions = useMemo(() => complexes.map((c) => ({ value: c.id, label: c.name })), [complexes]);
  const creatorOptions = useMemo(() => creators.map((c) => ({ value: c, label: c })), [creators]);
  const hasAdvanced = useMemo(() => {
    const keys: (keyof SearchFilterValues)[] = [
      "complex",
      "added_by",
      "contact",
      "contact_type",
      "view",
      "bedrooms_min",
      "bedrooms_max",
      "bathrooms_min",
      "bathrooms_max",
      "land_min",
      "land_max",
      "floor_min",
      "floor_max",
      "budget_min",
      "budget_max",
      "parking_min",
      "do_not_publish",
      "social",
    ];
    return keys.some((k) => Boolean(filters[k])) || filters.advanced === "1";
  }, [filters]);

  const [advancedOverride, setShowAdvanced] = useState<boolean | null>(null);
  const showAdvanced = advancedOverride ?? hasAdvanced;
  const [paragraph, setParagraph] = useState("");
  const [pending, startTransition] = useTransition();
  const [paraError, setParaError] = useState<string | null>(null);
  const [filtersFilled, setFiltersFilled] = useState(false);
  const searchRequest = useRef(0);

  function clearSearch() {
    searchRequest.current += 1;
    setParagraph("");
    setParaError(null);
    setFiltersFilled(false);
  }

  function runParagraphSearch() {
    const request = ++searchRequest.current;
    setParaError(null);
    setFiltersFilled(false);
    startTransition(async () => {
      try {
        const result = await searchPropertiesByParagraph(paragraph);
        if (request !== searchRequest.current) return;
        if (!result.ok) {
          setParaError(result.error);
          return;
        }
        const params = new URLSearchParams({ status: result.filters.status ?? "Active" });
        for (const [key, value] of Object.entries(result.filters)) {
          if (value) params.set(key, value);
        }
        setShowAdvanced(null);
        router.replace(`/app/properties?${params}`, { scroll: false });
        setFiltersFilled(true);
      } catch {
        if (request !== searchRequest.current) return;
        setParaError("Could not fill the filters. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            Quick search
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runParagraphSearch}
              disabled={pending || !paragraph.trim()}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
            >
              {pending ? "Searching…" : "Search properties"}
            </button>
            <button
              type="button"
              onClick={() => clearFilterGroup("property-filters", "basic")}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              Clear normal filters
            </button>
          </div>
        </div>
        <textarea
          value={paragraph}
          onChange={(e) => setParagraph(e.target.value)}
          rows={3}
          placeholder="Describe what you need, e.g. a 3-bedroom apartment in Colombo 02 for rent under USD 2,500."
          disabled={pending}
          className={`${inputClass} mt-2`}
        />
        {paraError ? (
          <p className="mt-2 text-sm text-[var(--danger)]">{paraError}</p>
        ) : null}
        {filtersFilled ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Filters filled from your description. Refine them below to update the results.
          </p>
        ) : null}
      </section>

      <LiveFilterForm
        id="property-filters"
        action="/app/properties"
        onClear={(group) => {
          if (group !== "advanced") clearSearch();
        }}
        className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
      >
        {showAdvanced ? <input type="hidden" name="advanced" value="1" /> : null}

        <div data-filter-group="basic" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <label className="col-span-2 text-sm font-medium">
            Keyword search
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
              data-default-value="Active"
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
          <MultiSelectFilter
            name="city"
            label="City"
            options={cityOptions}
            defaultValue={filters.city}
            allLabel="Search Sri Lanka cities"
            addLabel="Add city"
            emptyLabel="No cities found"
            className="xl:col-span-2"
            placesSuggest
          />
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
          <div className="col-span-2 grid grid-cols-1 xl:col-span-4">
            <RangeFilter
              label="Price"
              minName="price_min"
              maxName="price_max"
              defaultMin={filters.price_min}
              defaultMax={filters.price_max}
              ceiling={PRICE_CEILING}
              step={PRICE_STEP}
              money
              millions
              inputClassName={inputClass}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm font-semibold text-[var(--brand-deep)] hover:underline"
          >
            {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
          </button>
          {showAdvanced ? (
            <button
              type="button"
              onClick={() => clearFilterGroup("property-filters", "advanced")}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              Clear advanced filters
            </button>
          ) : null}
        </div>

        {/* Hidden rather than unmounted so a closed section keeps its values, e.g. a currency from quick search. */}
        <div data-filter-group="advanced" hidden={!showAdvanced} className="mt-4 space-y-5 border-t border-[var(--line)] pt-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MultiSelectFilter
              name="complex"
              label="Apartment complex"
              options={complexOptions}
              defaultValue={filters.complex}
              allLabel="All complexes"
              addLabel="Add complex"
              emptyLabel="No complexes found"
            />
            <MultiSelectFilter
              name="added_by"
              label="User"
              options={creatorOptions}
              defaultValue={filters.added_by}
              allLabel="All users"
              addLabel="Add user"
              emptyLabel="No users found"
            />
            <label className="text-sm font-medium">
              Name of Contact
              <input
                name="contact"
                defaultValue={filters.contact}
                placeholder="Owner or contact name"
                className={`${inputClass} mt-1`}
              />
            </label>
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
              Social Media
              <select
                name="social"
                defaultValue={filters.social}
                className={`${inputClass} mt-1`}
              >
                <option value="">Any</option>
                {SOCIAL_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
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
          <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RangeFilter
              label="Beds"
              minName="bedrooms_min"
              maxName="bedrooms_max"
              defaultMin={filters.bedrooms_min}
              defaultMax={filters.bedrooms_max}
              inputClassName={inputClass}
            />
            <RangeFilter
              label="Baths"
              minName="bathrooms_min"
              maxName="bathrooms_max"
              defaultMin={filters.bathrooms_min}
              defaultMax={filters.bathrooms_max}
              inputClassName={inputClass}
            />
            <RangeFilter
              label="Land (Perches)"
              minName="land_min"
              maxName="land_max"
              defaultMin={filters.land_min}
              defaultMax={filters.land_max}
              inputClassName={inputClass}
            />
            <RangeFilter
              label="Floor Area (Sqft)"
              minName="floor_min"
              maxName="floor_max"
              defaultMin={filters.floor_min}
              defaultMax={filters.floor_max}
              inputClassName={inputClass}
            />
            <RangeFilter
              label="Budget"
              minName="budget_min"
              maxName="budget_max"
              defaultMin={filters.budget_min}
              defaultMax={filters.budget_max}
              money
              inputClassName={inputClass}
            />
          </div>
        </div>
      </LiveFilterForm>
    </div>
  );
}
