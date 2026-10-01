"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  createProperty,
  extractPropertyFromParagraph,
  updateProperty,
} from "@/app/app/actions";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "@/app/app/user-management/dialogs";
import { COMMERCIAL_SUBTYPES } from "@/lib/constants";
import type { FormOptions } from "@/lib/form-options";
import { parseMapsLink } from "@/lib/maps-link";

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
  location_url: "",
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
  internal_comments: "",
};

type Props = {
  mode?: "create" | "edit";
  refNo?: string;
  /** Create mode: preview of the ref the system will assign on save. */
  nextRef?: string | null;
  initialValues?: Partial<PropertyFormValues>;
  initialAmenities?: string[];
  initialPlatforms?: string[];
  initialDoNotPublish?: boolean;
  complexes: ComplexOption[];
  options: FormOptions;
};

export function PropertyForm(props: Props) {
  const [resetKey, setResetKey] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  function reset() {
    setResetKey((k) => k + 1);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={topRef} className="scroll-mt-4">
      <PropertyFormInner
        key={resetKey}
        {...props}
        onReset={props.mode === "edit" ? undefined : reset}
      />
    </div>
  );
}

function PropertyFormInner({
  mode = "create",
  refNo,
  nextRef,
  initialValues,
  initialAmenities = [],
  initialPlatforms = [],
  initialDoNotPublish = false,
  complexes,
  options,
  onReset,
}: Props & { onReset?: () => void }) {
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
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
    if (nextType === "Land") {
      setAmenityChecks((prev) =>
        Object.fromEntries(Object.keys(prev).map((k) => [k, false])),
      );
    }
    setValues((prev) => ({
      ...prev,
      ...(nextType === "Land" ? { amenities: "" } : {}),
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
        if (
          next.property_type === "Commercial Property" &&
          next.purpose &&
          !next.suitable_for
        ) {
          next.suitable_for = next.purpose;
          next.purpose = "";
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

  const formAction = mode === "edit" ? updateProperty : createProperty;
  const currency = values.currency || "LKR";
  const hasTypeDetails = isHouseLike || isLand || isApartment || isCommercial;

  function bind(name: string) {
    return {
      name,
      value: values[name] ?? "",
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => setField(name, e.target.value),
    };
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {mode === "create" ? (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
              <SparkleIcon />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold leading-tight">
                Quick fill with AI
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
                Paste listing notes and we&apos;ll fill in the fields below.
                Review everything before saving.
              </p>
            </div>
          </div>
          <textarea
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            rows={3}
            placeholder="e.g. 4 bed house in Kandy for sale, 12 perch, 2800 sqft, Rs 45M, contact Nimal 077…"
            className={`${inputBase} mt-4 resize-y`}
          />
          <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {aiMessage ? (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${
                    aiError
                      ? "bg-red-50 text-[var(--danger)]"
                      : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {aiMessage}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={runExtract}
              disabled={pending || !paragraph.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)] disabled:opacity-50"
            >
              <SparkleIcon className="h-4 w-4" />
              {pending ? "Extracting…" : "Fill form with AI"}
            </button>
          </div>
        </section>
      ) : null}

      <form action={formAction} className="space-y-5 sm:space-y-6">
        {mode === "edit" && refNo ? (
          <input type="hidden" name="ref_no" value={refNo} />
        ) : null}

        <FormSection
          step={1}
          title="Property"
          description="What's being listed, its status and where it is."
        >
          <div className={grid3}>
            <div className="min-w-0">
              <FieldLabel>Ref No.</FieldLabel>
              <div
                className="mt-1.5 flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg-accent)]/60 px-3 py-2 text-sm"
                aria-readonly="true"
                title="Assigned automatically by the system"
              >
                <span className="font-semibold tabular-nums text-[var(--ink)]">
                  {mode === "edit" ? refNo || "—" : nextRef || "Auto-assigned"}
                </span>
                <LockIcon />
              </div>
              <FieldHint>
                {mode === "create"
                  ? "Assigned by the system when you save."
                  : "Reference numbers can't be changed."}
              </FieldHint>
            </div>
            <Field label="Opportunity" required>
              <select required {...bind("opportunity_type")} className={inputBase}>
                {options.opportunityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Property type" required>
              <select
                name="property_type"
                required
                value={values.property_type}
                onChange={(e) => onPropertyTypeChange(e.target.value)}
                className={inputBase}
              >
                {options.propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            {isCommercial ? (
              <Field label="Property sub-type">
                <select {...bind("property_subtype")} className={inputBase}>
                  <option value="">Select sub-type</option>
                  {values.property_subtype &&
                  !(COMMERCIAL_SUBTYPES as readonly string[]).includes(
                    values.property_subtype,
                  ) ? (
                    <option value={values.property_subtype}>
                      {values.property_subtype}
                    </option>
                  ) : null}
                  {COMMERCIAL_SUBTYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <input type="hidden" name="property_subtype" value="" />
            )}
            <Field label="Status">
              <select {...bind("status")} className={inputBase}>
                {options.statuses.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Furnished">
              <select {...bind("furnished")} className={inputBase}>
                <option value="">Not specified</option>
                {options.furnished.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SubHeading>Location</SubHeading>
          <div className={grid3}>
            <Field label="City" required>
              <input required {...bind("city")} className={inputBase} />
            </Field>
            <Field label="Address">
              <input
                {...bind("address")}
                className={inputBase}
                placeholder="Street, area"
              />
            </Field>
            <LocationLinkField
              className="sm:col-span-2 lg:col-span-1"
              value={values.location_url}
              onChange={(v) => setField("location_url", v)}
            />
          </div>
        </FormSection>

        <FormSection
          step={2}
          title="Contact"
          description="Owner or agent to reach about this listing."
        >
          <div className={grid3}>
            <Field label="Contact type">
              <select {...bind("contact_type")} className={inputBase}>
                <option value="">Select type</option>
                {options.contactTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name of contact" required>
              <input
                required
                {...bind("contact_name")}
                className={inputBase}
                autoComplete="off"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                {...bind("contact_email")}
                className={inputBase}
                placeholder="name@example.com"
                autoComplete="off"
              />
            </Field>
            <Field label="Contact No 1" required>
              <input
                type="tel"
                inputMode="tel"
                required
                {...bind("contact_phone_1")}
                className={inputBase}
                placeholder="07X XXX XXXX"
                autoComplete="off"
              />
            </Field>
            <Field label="Contact No 2">
              <input
                type="tel"
                inputMode="tel"
                {...bind("contact_phone_2")}
                className={inputBase}
                placeholder="Optional"
                autoComplete="off"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          step={3}
          title={`${typeLabel} details`}
          description="Fields change with the property type you picked."
        >
          {!hasTypeDetails ? (
            <p className="text-sm text-[var(--muted)]">
              No extra details for this property type.
            </p>
          ) : null}

          {isHouseLike ? (
            <div className={grid4}>
              <input type="hidden" name="purpose" value={values.purpose} />
              <Field label="Land size">
                <Affix suffix="perch">
                  <input
                    {...bind("land_size_perch")}
                    className={`${inputBase} pr-16`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
              <Field label="Floor area">
                <Affix suffix="sqft">
                  <input
                    {...bind("floor_area_sqft")}
                    className={`${inputBase} pr-14`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
              <Field label="Bedrooms">
                <input {...bind("bedrooms")} className={inputBase} />
              </Field>
              <Field label="Bathrooms">
                <input {...bind("bathrooms")} className={inputBase} />
              </Field>
              <Field label="Number of floors">
                <input {...bind("number_of_floors")} className={inputBase} />
              </Field>
              <Field label="Parking spaces">
                <input {...bind("parking_spaces")} className={inputBase} />
              </Field>
              <Field label="Age of the house">
                <Affix suffix="years">
                  <input
                    {...bind("age_years")}
                    className={`${inputBase} pr-16`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
            </div>
          ) : null}

          {isLand ? (
            <div className={grid4}>
              <Field label="Land size">
                <Affix suffix="perch">
                  <input
                    {...bind("land_size_perch")}
                    className={`${inputBase} pr-16`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
              <Field label="Suitable for" className="sm:col-span-1 lg:col-span-3">
                <input
                  {...bind("suitable_for")}
                  className={inputBase}
                  placeholder="e.g. Residential, Commercial"
                />
              </Field>
            </div>
          ) : null}

          {isApartment ? (
            <div className={grid4}>
              <Field label="Apartment complex" className="sm:col-span-2">
                <select {...bind("apartment_complex_id")} className={inputBase}>
                  <option value="">Select complex</option>
                  {complexes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Floor">
                <input {...bind("apartment_floor")} className={inputBase} />
              </Field>
              <Field label="Floor area">
                <Affix suffix="sqft">
                  <input
                    {...bind("floor_area_sqft")}
                    className={`${inputBase} pr-14`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
              <Field label="Number of rooms">
                <input {...bind("bedrooms")} className={inputBase} />
              </Field>
              <Field label="Number of bathrooms">
                <input {...bind("bathrooms")} className={inputBase} />
              </Field>
              <Field label="Dedicated parking slots">
                <input {...bind("parking_spaces")} className={inputBase} />
              </Field>
              <Field label="View">
                <input
                  {...bind("view")}
                  className={inputBase}
                  placeholder="e.g. Sea, City"
                />
              </Field>
            </div>
          ) : null}

          {isCommercial ? (
            <div className={grid4}>
              <Field label="Suitable for" className="sm:col-span-2">
                <input
                  {...bind("suitable_for")}
                  className={inputBase}
                  placeholder="e.g. Office, Retail, Warehouse"
                />
              </Field>
              <Field label="Size of land">
                <Affix suffix="perch">
                  <input
                    {...bind("land_size_perch")}
                    className={`${inputBase} pr-16`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
              <Field label="Built-up area">
                <input {...bind("built_up_area")} className={inputBase} />
              </Field>
            </div>
          ) : null}

          {!isHouseLike ? (
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
          {!isLand && !isCommercial ? (
            <input type="hidden" name="suitable_for" value="" />
          ) : null}
          {!isCommercial ? (
            <input type="hidden" name="built_up_area" value="" />
          ) : null}
        </FormSection>

        <FormSection
          step={4}
          title="Pricing"
          description="Leave any price you don't have blank."
        >
          <div
            className={`grid gap-x-4 gap-y-5 ${
              isLand ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            }`}
          >
            <Field label="Currency">
              <select {...bind("currency")} className={inputBase}>
                {options.currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            {(
              [
                ["Price total", "price_total"],
                ["Price per perch", "price_per_perch"],
                ...(isLand
                  ? []
                  : ([
                      ["Price per sqft", "price_per_sqft"],
                      ["Budget", "budget"],
                    ] as const)),
              ] as const
            ).map(([label, name]) => (
              <Field key={name} label={label}>
                <Affix suffix={currency}>
                  <input
                    {...bind(name)}
                    className={`${inputBase} pr-14 tabular-nums`}
                    inputMode="decimal"
                  />
                </Affix>
              </Field>
            ))}
          </div>
          {isLand ? (
            <>
              <input type="hidden" name="price_per_sqft" value={values.price_per_sqft} />
              <input type="hidden" name="budget" value={values.budget} />
            </>
          ) : null}
        </FormSection>

        {isLand ? (
          <>
            {options.amenities
              .filter((a) => amenityChecks[a])
              .map((a) => (
                <input key={a} type="hidden" name="amenity" value={a} />
              ))}
            <input type="hidden" name="amenities" value={values.amenities} />
          </>
        ) : null}

        <div
          className={`grid items-start gap-5 sm:gap-6 ${isLand ? "" : "xl:grid-cols-2"}`}
        >
          {!isLand ? (
          <FormSection
            step={5}
            title="Amenities"
            description="Tick everything the property offers."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.amenities.map((a) => (
                <CheckChip
                  key={a}
                  name="amenity"
                  value={a}
                  checked={Boolean(amenityChecks[a])}
                  onChange={(e) =>
                    setAmenityChecks((prev) => ({
                      ...prev,
                      [a]: e.target.checked,
                    }))
                  }
                >
                  {a}
                </CheckChip>
              ))}
            </div>
            <div className="mt-5">
              <Field
                label="Other amenities"
                hint="Separate extras with commas."
              >
                <input
                  {...bind("amenities")}
                  className={inputBase}
                  placeholder="Any extras not listed above"
                />
              </Field>
            </div>
          </FormSection>
          ) : null}

          <FormSection
            step={isLand ? 5 : 6}
            title={mode === "create" ? "Notes & publishing" : "Notes & visibility"}
            description={
              mode === "create"
                ? "Anything else to know, and where to post it."
                : "Anything else to know, and whether it's public."
            }
          >
            <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
              <Field
                label="Comments / other information"
                hint="Can appear on the public listing."
              >
                <textarea
                  {...bind("comments")}
                  rows={4}
                  className={`${inputBase} resize-y`}
                  placeholder="Access, viewing times, special terms…"
                />
              </Field>
              <Field
                label="Internal comments"
                hint="Staff only. Never shown publicly or posted."
              >
                <textarea
                  {...bind("internal_comments")}
                  rows={4}
                  className={`${inputBase} resize-y`}
                  placeholder="Owner notes, negotiation, follow-ups…"
                />
              </Field>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 p-3 sm:p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="do_not_publish"
                  checked={doNotPublish}
                  onChange={(e) => setDoNotPublish(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {mode === "create"
                      ? "Do not publish (record only)"
                      : "Do not publish"}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    Keeps the listing internal — it won&apos;t appear in public
                    search or go to social media.
                  </span>
                </span>
              </label>
            </div>

            {mode === "create" ? (
              <div className="mt-5">
                <FieldLabel>Post to</FieldLabel>
                <div
                  className={`mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 ${
                    doNotPublish ? "opacity-60" : ""
                  }`}
                >
                  {options.platforms.map((p) => (
                    <CheckChip
                      key={p}
                      name={`platform_${p}`}
                      checked={Boolean(platforms[p])}
                      disabled={doNotPublish}
                      onChange={(e) =>
                        setPlatforms((prev) => ({
                          ...prev,
                          [p]: e.target.checked,
                        }))
                      }
                    >
                      {p}
                    </CheckChip>
                  ))}
                </div>
                <FieldHint>
                  {doNotPublish
                    ? "Not needed for record-only listings."
                    : "Pick at least one platform, or tick Do not publish."}
                </FieldHint>
              </div>
            ) : null}
          </FormSection>
        </div>

        <div className="sticky bottom-3 z-10 flex gap-3">
          {onReset ? (
            <ResetButton
              onClick={() =>
                setConfirm({
                  title: "Reset the form?",
                  body: "This clears every field and tick box, including the AI notes. You can't undo this.",
                  confirmLabel: "Reset form",
                  danger: true,
                  onConfirm: onReset,
                })
              }
            />
          ) : null}
          <SubmitButton label={mode === "edit" ? "Save changes" : "Save listing"} />
        </div>
      </form>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

const inputBase =
  "block w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] transition placeholder:text-[var(--muted)]/60 hover:border-stone-300 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/15";
const grid3 = "grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3";
const grid4 = "grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4";

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      <header className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-6">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-bold text-[var(--brand)]">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold leading-tight">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="px-4 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 mt-7 flex items-center gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {children}
      </h3>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="block text-[13px] font-medium text-[var(--ink)]">
      {children}
      {required ? (
        <span className="ml-0.5 text-[var(--brand)]" aria-hidden>
          *
        </span>
      ) : null}
    </span>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1.5 block text-xs text-[var(--muted)]">{children}</span>
  );
}

function Field({
  label,
  required,
  hint,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <span className="mt-1.5 block">{children}</span>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </label>
  );
}

function LocationLinkField({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const parsed = parseMapsLink(value);
  const error = parsed.ok ? null : parsed.error;

  return (
    <label className={`block min-w-0 ${className}`}>
      <FieldLabel>Location</FieldLabel>
      <span className="mt-1.5 block">
        <input
          name="location_url"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder="Paste Google Maps link"
          aria-invalid={Boolean(error)}
          ref={(el) => el?.setCustomValidity(error ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (parsed.ok && parsed.url && parsed.url !== value) onChange(parsed.url);
          }}
          className={`${inputBase} ${error ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/15" : ""}`}
        />
      </span>
      {error ? (
        <span className="mt-1.5 block text-xs text-[var(--danger)]">{error}</span>
      ) : null}
    </label>
  );
}

function Affix({
  suffix,
  children,
}: {
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <span className="relative block">
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[var(--muted)]">
        {suffix}
      </span>
    </span>
  );
}

function CheckChip({
  children,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm transition hover:border-stone-300 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5 has-[:disabled]:cursor-not-allowed">
      <input
        type="checkbox"
        {...inputProps}
        className="h-4 w-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center rounded-xl bg-[var(--brand)] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-[var(--brand-deep)] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-5 py-3.5 text-base font-semibold text-[var(--ink)] shadow-lg transition hover:bg-[var(--bg-accent)] disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
        />
      </svg>
      Reset
    </button>
  );
}

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2m0 14v2M3 12h2m14 0h2M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5L12 7Z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}
