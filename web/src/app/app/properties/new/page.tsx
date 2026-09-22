import { PropertyForm } from "./property-form";

export default function NewPropertyPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Add listing</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Paste listing notes for AI fill, or enter fields manually — same save
        rules as before (platforms required unless Do Not Publish).
      </p>
      <div className="mt-8">
        <PropertyForm />
      </div>
    </div>
  );
}
