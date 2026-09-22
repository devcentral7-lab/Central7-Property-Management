"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createProperty,
  extractPropertyFromParagraph,
} from "@/app/app/actions";
import {
  AMENITIES_LIST,
  CONTACT_TYPES,
  FURNISHED_LIST,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
  SOCIAL_MEDIA_PLATFORMS,
} from "@/lib/constants";

const EMPTY: Record<string, string> = {
  contact_type: "",
  contact_name: "",
  contact_phone_1: "",
  contact_phone_2: "",
  contact_email: "",
  opportunity_type: "Sell",
  property_type: "House",
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
  apartment_floor: "",
  view: "",
  suitable_for: "",
  built_up_area: "",
  currency: "LKR",
  furnished: "",
  price_per_perch: "",
  price_per_sqft: "",
  price_total: "",
  budget: "",
  amenities: "",
  comments: "",
};

export function PropertyForm() {
  const [values, setValues] = useState(EMPTY);
  const [paragraph, setParagraph] = useState("");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({});
  const [doNotPublish, setDoNotPublish] = useState(false);

  const filledCount = useMemo(
    () =>
      Object.entries(values).filter(
        ([k, v]) =>
          v &&
          !["opportunity_type", "property_type", "currency"].includes(k),
      ).length,
    [values],
  );

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
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
          if (v) next[k] = v;
        }
        if (!result.fields.comments && paragraph.trim()) {
          next.comments = next.comments || paragraph.trim();
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
    "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm";

  return (
    <div className="max-w-3xl space-y-8">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <h2 className="font-display text-lg font-semibold">Paste listing notes</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Drop a free-form paragraph — Gemini fills only the fields it can
          find. You can edit everything afterward.
        </p>
        <textarea
          value={paragraph}
          onChange={(e) => setParagraph(e.target.value)}
          rows={5}
          placeholder="e.g. 4 bed house in Kandy for sale, 12 perch, 2800 sqft, Rs 45M, contact Nimal 077…"
          className={`${inputClass} mt-3`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runExtract}
            disabled={pending || !paragraph.trim()}
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
          >
            {pending ? "Extracting…" : "Fill form with AI"}
          </button>
        </div>
        {aiMessage ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              aiError
                ? "bg-red-50 text-[var(--danger)]"
                : "bg-[var(--bg-accent)] text-[var(--ink)]"
            }`}
          >
            {aiMessage}
          </p>
        ) : null}
        {filledCount > 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {filledCount} non-default fields currently set
          </p>
        ) : null}
      </section>

      <form action={createProperty} className="space-y-8">
        <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Contact</h2>
          <label className="text-sm font-medium">
            Contact type
            <select
              name="contact_type"
              value={values.contact_type}
              onChange={(e) => setField("contact_type", e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {CONTACT_TYPES.map((t) => (
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
          <label className="text-sm font-medium">
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

        <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:col-span-2 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Property</h2>
          <label className="text-sm font-medium">
            Opportunity *
            <select
              name="opportunity_type"
              required
              value={values.opportunity_type}
              onChange={(e) => setField("opportunity_type", e.target.value)}
              className={inputClass}
            >
              {OPPORTUNITY_TYPES.map((t) => (
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
              onChange={(e) => setField("property_type", e.target.value)}
              className={inputClass}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["City *", "city", true],
              ["Address", "address", false],
              ["Purpose", "purpose", false],
              ["Land size (perch)", "land_size_perch", false],
              ["Floor area (sqft)", "floor_area_sqft", false],
              ["Bedrooms", "bedrooms", false],
              ["Bathrooms", "bathrooms", false],
              ["Number of floors", "number_of_floors", false],
              ["Parking spaces", "parking_spaces", false],
              ["Age (years)", "age_years", false],
              ["Apartment floor", "apartment_floor", false],
              ["View", "view", false],
              ["Suitable for (Land)", "suitable_for", false],
              ["Built-up area (Commercial)", "built_up_area", false],
            ] as const
          ).map(([label, name, required]) => (
            <label key={name} className="text-sm font-medium">
              {label}
              <input
                name={name}
                required={required}
                value={values[name]}
                onChange={(e) => setField(name, e.target.value)}
                className={inputClass}
              />
            </label>
          ))}
        </section>

        <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Pricing</h2>
          <label className="text-sm font-medium">
            Currency
            <select
              name="currency"
              value={values.currency}
              onChange={(e) => setField("currency", e.target.value)}
              className={inputClass}
            >
              <option value="LKR">LKR</option>
              <option value="USD">USD</option>
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
              {FURNISHED_LIST.map((t) => (
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

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-display text-lg font-semibold">Amenities & notes</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Comma-separated, or pick from: {AMENITIES_LIST.slice(0, 5).join(", ")}…
          </p>
          <textarea
            name="amenities"
            rows={2}
            value={values.amenities}
            onChange={(e) => setField("amenities", e.target.value)}
            className={`${inputClass} mt-3`}
            placeholder="Gym, CCTV, Balcony"
          />
          <textarea
            name="comments"
            rows={4}
            value={values.comments}
            onChange={(e) => setField("comments", e.target.value)}
            className={`${inputClass} mt-3`}
            placeholder="Other information"
          />
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-display text-lg font-semibold">Publish</h2>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="do_not_publish"
              checked={doNotPublish}
              onChange={(e) => setDoNotPublish(e.target.checked)}
            />
            Do not publish (record only — no activity log)
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            {SOCIAL_MEDIA_PLATFORMS.map((p) => (
              <label
                key={p}
                className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  name={`platform_${p}`}
                  checked={Boolean(platforms[p])}
                  onChange={(e) =>
                    setPlatforms((prev) => ({ ...prev, [p]: e.target.checked }))
                  }
                />
                {p}
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
        >
          Save listing
        </button>
      </form>
    </div>
  );
}
