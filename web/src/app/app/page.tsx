import { requireProfile } from "@/lib/auth";
import { loadAdminAnalytics } from "@/lib/analytics";
import { colomboYear, parseDashboardRange } from "@/lib/dashboard-period";
import { loadUserDashboard } from "@/lib/user-dashboard";
import { AdminDashboard } from "@/app/app/dashboard/admin-dashboard";
import { UserDashboard } from "@/app/app/dashboard/user-dashboard";

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();

  if (profile.role === "Admin") {
    const sp = await searchParams;
    const first = (v: string | string[] | undefined) =>
      Array.isArray(v) ? v[0] : v;
    const view = first(sp.view) === "visuals" ? "visuals" : "stats";
    const range = parseDashboardRange(first(sp.period), first(sp.year), colomboYear());
    const result = await loadAdminAnalytics(range).then(
      (data) => ({ data, error: null }),
      (e: unknown) => ({
        data: null,
        error: e instanceof Error ? e.message : "Could not load analytics.",
      }),
    );
    if (result.data) {
      return <AdminDashboard data={result.data} view={view} />;
    }
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold text-[var(--brand-deep)]">
          Operations Overview
        </h1>
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {result.error}
        </p>
      </div>
    );
  }

  const result = await loadUserDashboard(profile.display_name).then(
    (data) => ({ data, error: null }),
    (e: unknown) => ({
      data: null,
      error: e instanceof Error ? e.message : "Could not load your dashboard.",
    }),
  );

  if (!result.data) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold text-[var(--brand-deep)]">
          Welcome Back, {profile.display_name}
        </h1>
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {result.error}
        </p>
      </div>
    );
  }

  return <UserDashboard name={profile.display_name} data={result.data} />;
}
