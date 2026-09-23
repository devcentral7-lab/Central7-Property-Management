"use client";

import { useState, useTransition } from "react";
import {
  createProperty,
  extractPropertyFromParagraph,
  updateProperty,
} from "@/app/app/actions";
import type { FormOptions } from "@/lib/form-options";

export type ComplexOption = { id: string; name: string };

export type PropertyFormValues = Record<string, string>;

const EMPTY: PropertyFormValues = {
  contact_type: "",
  contact_name: "",
  contact_phone_1: "",
  contact_phone_2: "",
  contact_email: "",
  opportunity_type: "Sell",
  property_type: "House",
  property_subtype: "",
  city: "",
  address: "",
  purpose: "",
  land_size_perch: "",
  floor_area_sqft: "",
  bedrooms: "",
  bathrooms: "",
  number_of_floors: "",
  parking_spaces: "",
  age_years: "",
  apartment_complex_id: "",
  apartment_floor: "",
  view: "",
  latitude: "",
  longitude: "",
  suitable_for: "",
  built_up_area: "",
  currency: "LKR",
  furnished: "",
  status: "Active",
  price_per_perch: "",
  price_per_sqft: "",
  price_total: "",
  budget: "",
  amenities: "",
  comments: "",
};

type Props = {
  mode?: "create" | "edit";
  refNo?: string;
  initialValues?: Partial<PropertyFormValues>;
  initialAmenities?: string[];
  initialPlatforms?: string[];
  initialDoNotPublish?: boolean;
  complexes: ComplexOption[];
  options: FormOptions;
};

export function PropertyForm({
  mode = "create",
  refNo,
  initialValues,
  initialAmenities = [],
  initialPlatforms = [],
  initialDoNotPublish = false,
  complexes,
  options,
}: Props) {
  const [values, setValues] = useState<PropertyFormValues>(() => ({
    ...EMPTY,
    opportunity_type: options.opportunityTypes[0] || "Sell",
    property_type: options.propertyTypes[0] || "House",
    currency: options.currencies[0] || "LKR",
    status: options.statuses.includes("Active")
      ? "Active"
      : options.statuses[0] || "Active",
    ...Object.fromEntries(
      Object.entries(initialValues ?? {}).map(([k, v]) => [k, v ?? ""]),
    ),
  }));
  const [paragraph, setParagraph] = useState("");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amenityChecks, setAmenityChecks] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        options.amenities.map((a) => [a, initialAmenities.includes(a)]),
      ),
  );
  const [platforms, setPlatforms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      options.platforms.map((p) => [p, initialPlatforms.includes(p)]),
    ),
  );
  const [doNotPublish, setDoNotPublish] = useState(initialDoNotPublish);

  const propertyType = values.property_type;
  const isLand = propertyType === "Land";
  const isApartment = propertyType === "Apartment";
  const isCommercial = propertyType === "Commercial Property";
  const isHouseLike =
    propertyType === "House" || propertyType === "Estate";
  const typeLabel = propertyType || "Property";

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function onPropertyTypeChange(nextType: string) {
    setValues((prev) => ({
      ...prev,
      property_type: nextType,
      purpose: "",
      land_size_perch: "",
      floor_area_sqft: "",
      bedrooms: "",
      bathrooms: "",
      number_of_floors: "",
      parking_spaces: "",
      age_years: "",
      apartment_complex_id: "",
      apartment_floor: "",
      view: "",
      suitable_for: "",
      built_up_area: "",
    }));
  }

  function runExtract() {
    setAiMessage(null);
    setAiError(false);
    startTransition(async () => {
      const result = await extractPropertyFromParagraph(paragraph);
      if (!result.ok) {
        setAiError(true);
        setAiMessage(result.error);
        return;
      }
      const keys = Object.keys(result.fields);
      if (!keys.length) {
        setAiError(true);
        setAiMessage("No fields found in that text. Try a richer paragraph.");
        return;
      }
      setValues((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(result.fields)) {
          if (v && k !== "amenities") next[k] = v;
        }
        if (!result.fields.comments && paragraph.trim()) {
          next.comments = next.comments || paragraph.trim();
        }
        if (result.fields.amenities) {
          const parts = result.fields.amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);
          setAmenityChecks((checks) => {
            const updated = { ...checks };
            for (const a of options.amenities) {
              if (parts.some((p) => p.toLowerCase() === a.toLowerCase())) {
                updated[a] = true;
              }
            }
            return updated;
          });
          next.amenities = parts
            .filter(
              (p) =>
                !options.amenities.some(
                  (a) => a.toLowerCase() === p.toLowerCase(),
                ),
            )
            .join(", ");
        }
        return next;
      });
      setAiError(false);
      setAiMessage(
        `Filled ${keys.length} field${keys.length === 1 ? "" : "s"} from the paragraph. Review before saving.`,
      );
    });
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm";
  const sectionClass =
    "grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 sm:grid-cols-2 xl:grid-cols-3";
  const formAction = mode === "edit" ? updateProperty : createProperty;

  return (
    <div className="w-full space-y-4">
      {mode === "create" ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-base font-semibold">
              Paste listing notes
            </h2>
            <button
              type="button"
              onClick={runExtract}
              disabled={pending || !paragraph.trim()}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
            >
              {pending ? "Extracting…" : "Fill form with AI"}
            </button>
          </div>
          <textarea
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            rows={2}
            placeholder="e.g. 4 bed house in Kandy for sale, 12 perch, 2800 sqft, Rs 45M, contact Nimal 077…"
            className={`${inputClass} mt-2`}
          />
          {aiMessage ? (
            <p
              className={`mt-2 rounded-lg px-3 py-1.5 text-sm ${
                aiError
                  ? "bg-red-50 text-[var(--danger)]"
                  : "bg-[var(--bg-accent)] text-[var(--ink)]"
              }`}
            >
              {aiMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      <form action={formAction} className="space-y-4">
        {mode === "edit" && refNo ? (
          <input type="hidden" name="ref_no" value={refNo} />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <section className={sectionClass}>
            <h2 className="font-display text-base font-semibold sm:col-span-2 xl:col-span-3">
              Contact
            </h2>
            <label className="text-sm font-medium">
              Contact type
              <select
                name="contact_type"
                value={values.contact_type}
                onChange={(e) => setField("contact_type", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {options.contactTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Name of contact *
              <input
                name="contact_name"
                required
                value={values.contact_name}
                onChange={(e) => setField("contact_name", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Contact No 1 *
              <input
                name="contact_phone_1"
                required
                value={values.contact_phone_1}
                onChange={(e) => setField("contact_phone_1", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Contact No 2
              <input
                name="contact_phone_2"
                value={values.contact_phone_2}
                onChange={(e) => setField("contact_phone_2", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Email
              <input
                name="contact_email"
                type="email"
                value={values.contact_email}
                onChange={(e) => setField("contact_email", e.target.value)}
                className={inputClass}
              />
            </label>
          </section>

          <section className={sectionClass}>
            <h2 className="font-display text-base font-semibold sm:col-span-2 xl:col-span-3">
              Property
            </h2>
            <label className="text-sm font-medium">
              Opportunity *
              <select
                name="opportunity_type"
                required
                value={values.opportunity_type}
                onChange={(e) => setField("opportunity_type", e.target.value)}
                className={inputClass}
              >
                {options.opportunityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Property type *
              <select
                name="property_type"
                required
                value={values.property_type}
                onChange={(e) => onPropertyTypeChange(e.target.value)}
                className={inputClass}
              >
                {options.propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Property sub-type
              <input
                name="property_subtype"
                value={values.property_subtype}
                onChange={(e) => setField("property_subtype", e.target.value)}
                className={inputClass}
                placeholder="e.g. Villa, Annex, Shop"
              />
            </label>
            <label className="text-sm font-medium">
              Status
              <select
                name="status"
                value={values.status}
                onChange={(e) => setField("status", e.target.value)}
                className={inputClass}
              >
                {options.statuses.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              City *
              <input
                name="city"
                required
                value={values.city}
                onChange={(e) => setField("city", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Address
              <input
                name="address"
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Latitude
              <input
                name="latitude"
                value={values.latitude}
                onChange={(e) => setField("latitude", e.target.value)}
                className={inputClass}
                placeholder="e.g. 7.2906"
                inputMode="decimal"
              />
            </label>
            <label className="text-sm font-medium">
              Longitude
              <input
                name="longitude"
                value={values.longitude}
                onChange={(e) => setField("longitude", e.target.value)}
                className={inputClass}
                placeholder="e.g. 80.6337"
                inputMode="decimal"
              />
            </label>
          </section>

          <section className={sectionClass}>
            <div className="sm:col-span-2 xl:col-span-3">
              <h2 className="font-display text-base font-semibold">
                {typeLabel} details
              </h2>
            </div>

            {isHouseLike ? (
              <>
                <label className="text-sm font-medium">
                  Purpose
                  <input
                    name="purpose"
                    value={values.purpose}
                    onChange={(e) => setField("purpose", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Land size (perch)
                  <input
                    name="land_size_perch"
                    value={values.land_size_perch}
                    onChange={(e) => setField("land_size_perch", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Bedrooms
                  <input
                    name="bedrooms"
                    value={values.bedrooms}
                    onChange={(e) => setField("bedrooms", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Bathrooms
                  <input
                    name="bathrooms"
                    value={values.bathrooms}
                    onChange={(e) => setField("bathrooms", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Floor area (sqft)
                  <input
                    name="floor_area_sqft"
                    value={values.floor_area_sqft}
                    onChange={(e) => setField("floor_area_sqft", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Number of floors
                  <input
                    name="number_of_floors"
                    value={values.number_of_floors}
                    onChange={(e) => setField("number_of_floors", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Parking spaces
                  <input
                    name="parking_spaces"
                    value={values.parking_spaces}
                    onChange={(e) => setField("parking_spaces", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Age of the house (years)
                  <input
                    name="age_years"
                    value={values.age_years}
                    onChange={(e) => setField("age_years", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}

            {isLand ? (
              <>
                <label className="text-sm font-medium">
                  Land size (perch)
                  <input
                    name="land_size_perch"
                    value={values.land_size_perch}
                    onChange={(e) => setField("land_size_perch", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Suitable for
                  <input
                    name="suitable_for"
                    value={values.suitable_for}
                    onChange={(e) => setField("suitable_for", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}

            {isApartment ? (
              <>
                <label className="text-sm font-medium">
                  Apartment complex
                  <select
                    name="apartment_complex_id"
                    value={values.apartment_complex_id}
                    onChange={(e) =>
                      setField("apartment_complex_id", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {complexes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Floor
                  <input
                    name="apartment_floor"
                    value={values.apartment_floor}
                    onChange={(e) => setField("apartment_floor", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Number of rooms
                  <input
                    name="bedrooms"
                    value={values.bedrooms}
                    onChange={(e) => setField("bedrooms", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Number of bathrooms
                  <input
                    name="bathrooms"
                    value={values.bathrooms}
                    onChange={(e) => setField("bathrooms", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Floor area (sqft)
                  <input
                    name="floor_area_sqft"
                    value={values.floor_area_sqft}
                    onChange={(e) => setField("floor_area_sqft", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Dedicated parking slots
                  <input
                    name="parking_spaces"
                    value={values.parking_spaces}
                    onChange={(e) => setField("parking_spaces", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  View
                  <input
                    name="view"
                    value={values.view}
                    onChange={(e) => setField("view", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}

            {isCommercial ? (
              <>
                <label className="text-sm font-medium">
                  Purpose
                  <input
                    name="purpose"
                    value={values.purpose}
                    onChange={(e) => setField("purpose", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Size of land (perch)
                  <input
                    name="land_size_perch"
                    value={values.land_size_perch}
                    onChange={(e) => setField("land_size_perch", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  Built-up area
                  <input
                    name="built_up_area"
                    value={values.built_up_area}
                    onChange={(e) => setField("built_up_area", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}

            {!isHouseLike && !isCommercial ? (
              <input type="hidden" name="purpose" value="" />
            ) : null}
            {!isHouseLike && !isLand && !isCommercial ? (
              <input type="hidden" name="land_size_perch" value="" />
            ) : null}
            {!isHouseLike && !isApartment ? (
              <>
                <input type="hidden" name="floor_area_sqft" value="" />
                <input type="hidden" name="bedrooms" value="" />
                <input type="hidden" name="bathrooms" value="" />
                <input type="hidden" name="parking_spaces" value="" />
              </>
            ) : null}
            {!isHouseLike ? (
              <>
                <input type="hidden" name="number_of_floors" value="" />
                <input type="hidden" name="age_years" value="" />
              </>
            ) : null}
            {!isApartment ? (
              <>
                <input type="hidden" name="apartment_complex_id" value="" />
                <input type="hidden" name="apartment_floor" value="" />
                <input type="hidden" name="view" value="" />
              </>
            ) : null}
            {!isLand ? (
              <input type="hidden" name="suitable_for" value="" />
            ) : null}
            {!isCommercial ? (
              <input type="hidden" name="built_up_area" value="" />
            ) : null}
          </section>

          <section className={sectionClass}>
            <h2 className="font-display text-base font-semibold sm:col-span-2 xl:col-span-3">
              Pricing
            </h2>
            <label className="text-sm font-medium">
              Currency
              <select
                name="currency"
                value={values.currency}
                onChange={(e) => setField("currency", e.target.value)}
                className={inputClass}
              >
                {options.currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Furnished
              <select
                name="furnished"
                value={values.furnished}
                onChange={(e) => setField("furnished", e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {options.furnished.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["Price per perch", "price_per_perch"],
                ["Price per sqft", "price_per_sqft"],
                ["Price total", "price_total"],
                ["Budget", "budget"],
              ] as const
            ).map(([label, name]) => (
              <label key={name} className="text-sm font-medium">
                {label}
                <input
                  name={name}
                  value={values[name]}
                  onChange={(e) => setField(name, e.target.value)}
                  className={inputClass}
                />
              </label>
            ))}
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="font-display text-base font-semibold">Amenities</h2>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {options.amenities.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="amenity"
                    value={a}
                    checked={Boolean(amenityChecks[a])}
                    onChange={(e) =>
                      setAmenityChecks((prev) => ({
                        ...prev,
                        [a]: e.target.checked,
                      }))
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm font-medium">
              Other amenities (comma-separated)
              <input
                name="amenities"
                value={values.amenities}
                onChange={(e) => setField("amenities", e.target.value)}
                className={inputClass}
                placeholder="Any extras not listed above"
              />
            </label>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
              <label className="block text-sm font-medium">
                Comments / other information
                <textarea
                  name="comments"
                  rows={3}
                  value={values.comments}
                  onChange={(e) => setField("comments", e.target.value)}
                  className={inputClass}
                />
              </label>
            </section>

            {mode === "create" ? (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
                <h2 className="font-display text-base font-semibold">Publish</h2>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="do_not_publish"
                    checked={doNotPublish}
                    onChange={(e) => setDoNotPublish(e.target.checked)}
                  />
                  Do not publish (record only)
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {options.platforms.map((p) => (
                    <label
                      key={p}
                      className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        name={`platform_${p}`}
                        checked={Boolean(platforms[p])}
                        onChange={(e) =>
                          setPlatforms((prev) => ({
                            ...prev,
                            [p]: e.target.checked,
                          }))
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
                <h2 className="font-display text-base font-semibold">
                  Visibility
                </h2>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="do_not_publish"
                    checked={doNotPublish}
                    onChange={(e) => setDoNotPublish(e.target.checked)}
                  />
                  Do not publish
                </label>
              </section>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-[var(--brand)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
          >
            {mode === "edit" ? "Save changes" : "Save listing"}
          </button>
        </div>
      </form>
    </div>
  );
}
