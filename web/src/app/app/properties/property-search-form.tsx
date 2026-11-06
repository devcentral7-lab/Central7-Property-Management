"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RangeFilter } from "@/components/range-filter";
import { useCities } from "@/components/cities-context";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { LiveFilterForm, clearFilterGroup } from "@/components/live-filter-form";
import { searchPropertiesByParagraph } from "@/app/app/properties/search-actions";
import { COMMERCIAL_SUBTYPES } from "@/lib/constants";
import type { FormOptions } from "@/lib/form-options";
import { SOCIAL_FILTERS } from "@/lib/social-filters";
import type { SearchFilterValues } from "@/lib/property-search-filters";

export type { SearchFilterValues };

const inputClass =
  "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-normal";

/** Slider scale only; typed min/max can exceed this. */
const PRICE_CEILING = 200_000_000;
const PRICE_STEP = 1_000_000;

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
  const isCommercial = filters.property_type === "Commercial Property";
  const hasAdvanced = useMemo(() => {
    const keys: (keyof SearchFilterValues)[] = [
      "complex",
      "added_by",
      "contact",
      "phone",
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
            Quick Search
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runParagraphSearch}
              disabled={pending || !paragraph.trim()}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
            >
              {pending ? "Searching…" : "Search Properties"}
            </button>
            <button
              type="button"
              onClick={() => clearFilterGroup("property-filters", "basic")}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              Clear Filters
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
          <label className="col-span-2 text-sm font-semibold">
            Keyword Search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Ref, Contact, Address, City…"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Status
            <select
              name="status"
              defaultValue={filters.status}
              data-default-value="Active"
              className={`${inputClass} mt-1`}
            >
              <option value="">All Statuses</option>
              {options.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Property Type
            <select
              name="property_type"
              defaultValue={filters.property_type}
              className={`${inputClass} mt-1`}
            >
              <option value="">All Types</option>
              {options.propertyTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {isCommercial ? (
            <label className="text-sm font-semibold">
              Property Sub Type
              <select
                name="property_subtype"
                defaultValue={filters.property_subtype}
                className={`${inputClass} mt-1`}
              >
                <option value="">All Sub Types</option>
                {COMMERCIAL_SUBTYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <MultiSelectFilter
            name="city"
            label="City"
            options={cityOptions}
            defaultValue={filters.city}
            allLabel="Search Sri Lanka Cities"
            addLabel="Add City"
            emptyLabel="No Cities Found"
            className="xl:col-span-2"
            placesSuggest
          />
          <label className="text-sm font-semibold">
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
          <label className="text-sm font-semibold">
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
          <label className="text-sm font-semibold">
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
            {showAdvanced ? "Hide Advance Filters" : "Show Advance Filters"}
          </button>
          {showAdvanced ? (
            <button
              type="button"
              onClick={() => clearFilterGroup("property-filters", "advanced")}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              Clear Advance Filters
            </button>
          ) : null}
        </div>

        {/* Hidden rather than unmounted so a closed section keeps its values, e.g. a currency from quick search. */}
        <div data-filter-group="advanced" hidden={!showAdvanced} className="mt-4 space-y-5 border-t border-[var(--line)] pt-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MultiSelectFilter
              name="complex"
              label="Apartment Complex"
              options={complexOptions}
              defaultValue={filters.complex}
              allLabel="All Complexes"
              addLabel="Add Complex"
              emptyLabel="No Complexes Found"
            />
            <MultiSelectFilter
              name="added_by"
              label="User"
              options={creatorOptions}
              defaultValue={filters.added_by}
              allLabel="All Users"
              addLabel="Add User"
              emptyLabel="No Users Found"
            />
            <label className="text-sm font-semibold">
              Name of Contact
              <input
                name="contact"
                defaultValue={filters.contact}
                placeholder="Owner or Contact Name"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-semibold">
              Phone Number
              <input
                name="phone"
                defaultValue={filters.phone}
                placeholder="Contact Phone Number"
                inputMode="tel"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
              View
              <input
                name="view"
                defaultValue={filters.view}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
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
