import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listComplexes } from "@/app/app/complexes/actions";
import { AddComplexButton, ComplexesTable } from "@/app/app/complexes/complexes-table";
import { StatCard, type IconName } from "@/app/app/user-management/ui";

export default async function ComplexesPage() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  let rows: Awaited<ReturnType<typeof listComplexes>> = [];
  let loadError: string | null = null;
  try {
    rows = await listComplexes();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load apartment complexes.";
  }

  const locations = [...new Set(rows.map((c) => c.location).filter((l): l is string => Boolean(l)))].sort();
  const stats: { label: string; value: number; hint?: string; icon: IconName; accent?: boolean }[] = [
    { label: "Total complexes", value: rows.length, icon: "building", accent: true },
    {
      label: "With listings",
      value: rows.filter((c) => c.listing_count > 0).length,
      hint: "Used on at least one listing",
      icon: "check",
    },
    {
      label: "Linked listings",
      value: rows.reduce((n, c) => n + c.listing_count, 0),
      hint: "Apartments with a complex",
      icon: "link",
    },
    {
      label: "Missing details",
      value: rows.filter((c) => !c.location || !c.amenities.length).length,
      hint: "No location or amenities",
      icon: "clock",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Apartment complexes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            View, add, edit and remove the apartment buildings used on listings.
          </p>
        </div>
        <div className="shrink-0">
          <AddComplexButton locations={locations} />
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
        <ComplexesTable rows={rows} locations={locations} />
      )}
    </div>
  );
}
