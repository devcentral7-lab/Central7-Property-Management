import { createProperty } from "@/app/app/actions";
import {
  AMENITIES_LIST,
  CONTACT_TYPES,
  FURNISHED_LIST,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
  SOCIAL_MEDIA_PLATFORMS,
} from "@/lib/constants";

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}

export default function NewPropertyPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Add listing</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Mirrors Code.gs `saveProperty` rules — platforms required unless Do Not Publish.
      </p>

      <form action={createProperty} className="mt-8 space-y-8">
        <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Contact</h2>
          <label className="text-sm font-medium">
            Contact type
            <select name="contact_type" className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              <option value="">—</option>
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Field label="Name of contact *" name="contact_name" required />
          <Field label="Contact No 1 *" name="contact_phone_1" required />
          <Field label="Contact No 2" name="contact_phone_2" />
          <Field label="Email" name="contact_email" type="email" />
        </section>

        <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Property</h2>
          <label className="text-sm font-medium">
            Opportunity *
            <select name="opportunity_type" required className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Property type *
            <select name="property_type" required className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Field label="City *" name="city" required />
          <Field label="Address" name="address" />
          <Field label="Purpose" name="purpose" />
          <Field label="Land size (perch)" name="land_size_perch" />
          <Field label="Floor area (sqft)" name="floor_area_sqft" />
          <Field label="Bedrooms" name="bedrooms" />
          <Field label="Bathrooms" name="bathrooms" />
          <Field label="Number of floors" name="number_of_floors" />
          <Field label="Parking spaces" name="parking_spaces" />
          <Field label="Age (years)" name="age_years" />
          <Field label="Apartment floor" name="apartment_floor" />
          <Field label="View" name="view" />
          <Field label="Suitable for (Land)" name="suitable_for" />
          <Field label="Built-up area (Commercial)" name="built_up_area" />
        </section>

        <section className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Pricing</h2>
          <label className="text-sm font-medium">
            Currency
            <select name="currency" className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm" defaultValue="LKR">
              <option value="LKR">LKR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Furnished
            <select name="furnished" className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              <option value="">—</option>
              {FURNISHED_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Field label="Price per perch" name="price_per_perch" />
          <Field label="Price per sqft" name="price_per_sqft" />
          <Field label="Price total" name="price_total" />
          <Field label="Budget" name="budget" />
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-display text-lg font-semibold">Amenities & notes</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Comma-separated, or pick from: {AMENITIES_LIST.slice(0, 5).join(", ")}…
          </p>
          <textarea
            name="amenities"
            rows={2}
            className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            placeholder="Gym, CCTV, Balcony"
          />
          <textarea
            name="comments"
            rows={4}
            className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            placeholder="Other information"
          />
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-display text-lg font-semibold">Publish</h2>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="do_not_publish" />
            Do not publish (record only — no activity log)
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            {SOCIAL_MEDIA_PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm">
                <input type="checkbox" name={`platform_${p}`} />
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
