import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { loadCityStats, type CityStats } from "@/app/app/cities/actions";
import { AddCityButton, CitiesTable } from "@/app/app/cities/cities-table";
import { StatCard, type IconName } from "@/app/app/user-management/ui";

export default async function CitiesPage() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  let data: CityStats = { rows: [], listCount: 0, totalListings: 0, noCity: 0 };
  let loadError: string | null = null;
  try {
    data = await loadCityStats();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load cities.";
  }

  const listed = data.rows.filter((r) => r.inList);
  const unlisted = data.rows.filter((r) => !r.inList);
  const top = data.rows[0];
  const stats: { label: string; value: number; hint?: string; icon: IconName; accent?: boolean }[] = [
    { label: "Cities on the list", value: data.listCount, hint: "In city dropdowns", icon: "pin", accent: true },
    {
      label: "Cities with listings",
      value: listed.filter((r) => r.total > 0).length,
      hint: `${listed.filter((r) => !r.total).length.toLocaleString()} with none`,
      icon: "check",
    },
    {
      label: "Top city listings",
      value: top?.total ?? 0,
      hint: top?.total ? top.name : "No listings yet",
      icon: "building",
    },
    {
      label: "Listings not on list",
      value: unlisted.reduce((n, r) => n + r.total, 0),
      hint: `${unlisted.length.toLocaleString()} names${data.noCity ? ` · ${data.noCity.toLocaleString()} blank` : ""}`,
      icon: "clock",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Cities</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add or remove the cities staff can pick on listings and filters, and see how listings break down by city.
          </p>
        </div>
        <div className="shrink-0">
          <AddCityButton />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {loadError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">{loadError}</p>
      ) : (
        <CitiesTable rows={data.rows} />
      )}
    </div>
  );
}
