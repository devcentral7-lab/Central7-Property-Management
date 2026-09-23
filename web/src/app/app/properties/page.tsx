import Link from "next/link";
import { requireProfile } from "@/lib/auth";
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
    status: one(sp.status),
    opportunity_type: one(sp.opportunity_type),
    property_type: one(sp.property_type),
    property_subtype: one(sp.property_subtype).trim(),
    contact_type: one(sp.contact_type),
    city: one(sp.city).trim(),
    furnished: one(sp.furnished),
    currency: one(sp.currency),
    agent: one(sp.agent).trim(),
    purpose: one(sp.purpose).trim(),
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
    floors_min: one(sp.floors_min).trim(),
    floors_max: one(sp.floors_max).trim(),
    age_max: one(sp.age_max).trim(),
    do_not_publish: one(sp.do_not_publish),
    amenities: one(sp.amenities).trim(),
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

  const filters = filtersFromParams(sp);
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);
  const target =
    isAdmin && one(sp.user) ? one(sp.user) : profile.display_name;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Properties</h1>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
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

      <div className="mt-8">
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
          />
        ) : null}
      </div>
    </div>
  );
}
