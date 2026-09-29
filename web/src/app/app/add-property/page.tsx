import { requireProfile } from "@/lib/auth";
import { PropertyAddPanel } from "@/app/app/properties/property-add";

export default async function AddPropertyPage() {
  await requireProfile();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Add property</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Create a new listing. A reference number is assigned automatically.
      </p>
      <div className="mt-5 sm:mt-6">
        <PropertyAddPanel isAdmin={false} section="add" />
      </div>
    </div>
  );
}
