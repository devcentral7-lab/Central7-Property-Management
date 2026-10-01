import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { mineFiltersFromParams } from "@/lib/my-properties-filters";
import { PropertyAddPanel } from "@/app/app/properties/property-add";
import { PropertyMinePanel } from "@/app/app/properties/property-mine";
import { PropertySearchPanel } from "@/app/app/properties/property-search";
import type { SearchFilterValues } from "@/app/app/properties/property-search-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function filtersFromParams(
  sp: Record<string, string | string[] | undefined>,
): SearchFilterValues {
  return {
    q: one(sp.q).trim(),
    // No status param means a fresh search (default Active); an empty one means "All statuses".
    status: sp.status === undefined ? "Active" : one(sp.status),
    opportunity_type: one(sp.opportunity_type),
    property_type: one(sp.property_type),
    complex: one(sp.complex).trim(),
    contact_type: one(sp.contact_type),
    city: one(sp.city).trim(),
    furnished: one(sp.furnished),
    currency: one(sp.currency),
    view: one(sp.view).trim(),
    bedrooms_min: one(sp.bedrooms_min).trim(),
    bedrooms_max: one(sp.bedrooms_max).trim(),
    bathrooms_min: one(sp.bathrooms_min).trim(),
    bathrooms_max: one(sp.bathrooms_max).trim(),
    land_min: one(sp.land_min).trim(),
    land_max: one(sp.land_max).trim(),
    floor_min: one(sp.floor_min).trim(),
    floor_max: one(sp.floor_max).trim(),
    price_min: one(sp.price_min).trim(),
    price_max: one(sp.price_max).trim(),
    budget_min: one(sp.budget_min).trim(),
    budget_max: one(sp.budget_max).trim(),
    parking_min: one(sp.parking_min).trim(),
    do_not_publish: one(sp.do_not_publish),
    advanced: one(sp.advanced),
  };
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "Admin";
  const sp = await searchParams;
  const tabRaw = one(sp.tab).toLowerCase();
  const tab =
    tabRaw === "add" || tabRaw === "options"
      ? tabRaw === "options"
        ? "options"
        : "add"
      : tabRaw === "mine"
        ? "mine"
        : "search";

  const outerTab = tab === "options" || tab === "add" ? "add" : tab;

  const filters = filtersFromParams(sp);
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);

  if (!isAdmin) {
    if (outerTab === "add") redirect("/app/add-property");
    if (outerTab === "mine") redirect(page > 1 ? `/app/my-properties?page=${page}` : "/app/my-properties");
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Search properties</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Find any listing by keyword, location, type, price or features.
        </p>
        <div className="mt-5 sm:mt-6">
          <PropertySearchPanel filters={filters} page={page} />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "search" as const, label: "Search & Filter", href: "/app/properties" },
    {
      id: "add" as const,
      label: "Add Property",
      href: "/app/properties?tab=add",
    },
    {
      id: "mine" as const,
      label: "My Properties",
      href: "/app/properties?tab=mine",
    },
  ];

  const target =
    isAdmin && one(sp.user) ? one(sp.user) : profile.display_name;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Properties</h1>

      <div className="tab-scroll -mx-4 mt-5 border-b border-[var(--line)] px-4 pb-3 sm:mx-0 sm:mt-6 sm:px-0">
        {tabs.map((t) => {
          const active = t.id === outerTab;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5 sm:mt-8">
        {outerTab === "search" ? (
          <PropertySearchPanel filters={filters} page={page} />
        ) : null}
        {outerTab === "add" ? (
          <PropertyAddPanel
            isAdmin={isAdmin}
            section={tab === "options" ? "options" : "add"}
          />
        ) : null}
        {outerTab === "mine" ? (
          <PropertyMinePanel
            target={target}
            page={page}
            isAdmin={isAdmin}
            filters={mineFiltersFromParams(sp)}
          />
        ) : null}
      </div>
    </div>
  );
}
