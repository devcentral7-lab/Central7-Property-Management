import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { mineFiltersFromParams } from "@/lib/my-properties-filters";
import { searchFiltersFromParams } from "@/lib/property-search-filters";
import { PropertyAddPanel } from "@/app/app/properties/property-add";
import { PropertyMinePanel } from "@/app/app/properties/property-mine";
import { PropertySearchPanel } from "@/app/app/properties/property-search";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
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

  const filters = searchFiltersFromParams(sp);
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);

  if (!isAdmin) {
    if (outerTab === "add") redirect("/app/add-property");
    if (outerTab === "mine") redirect(page > 1 ? `/app/my-properties?page=${page}` : "/app/my-properties");
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Search Properties</h1>
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
          <PropertySearchPanel filters={filters} page={page} isAdmin={isAdmin} />
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
            selfName={profile.display_name}
            page={page}
            isAdmin={isAdmin}
            filters={mineFiltersFromParams(sp)}
          />
        ) : null}
      </div>
    </div>
  );
}
