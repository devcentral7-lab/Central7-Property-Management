import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { mineFiltersFromParams } from "@/lib/my-properties-filters";
import { PropertyMinePanel } from "@/app/app/properties/property-mine";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function MyPropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "Admin";
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);
  const target = isAdmin && one(sp.user) ? one(sp.user) : profile.display_name;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">My properties</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isAdmin
              ? "Listings you’ve added. Click a row to view, edit or update its status."
              : "Listings you’ve added. Click a row to view it, update its status or request a change."}
          </p>
        </div>
        <Link
          href="/app/add-property"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-deep)]"
        >
          + Add property
        </Link>
      </header>
      <div className="mt-5 sm:mt-6">
        <PropertyMinePanel
          target={target}
          page={page}
          isAdmin={isAdmin}
          filters={mineFiltersFromParams(sp)}
          standalone
        />
      </div>
    </div>
  );
}
