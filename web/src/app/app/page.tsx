import { requireProfile } from "@/lib/auth";
import { loadAdminAnalytics } from "@/lib/analytics";
import { colomboYear, parseDashboardRange } from "@/lib/dashboard-period";
import {
  loadCompanyPerformance,
  loadMyPerformance,
  performanceYears,
  resolvePerformancePeriod,
} from "@/lib/finance";
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
    const salesPeriod = resolvePerformancePeriod({
      from: first(sp.sales_from),
      to: first(sp.sales_to),
      month: first(sp.sales_month),
      year: first(sp.sales_year),
    });
    const [result, companySales] = await Promise.all([
      loadAdminAnalytics(range).then(
        (data) => ({ data, error: null }),
        (e: unknown) => ({
          data: null,
          error: e instanceof Error ? e.message : "Could not load analytics.",
        }),
      ),
      loadCompanyPerformance(salesPeriod).then(
        (figures) => ({ figures, error: null }),
        () => ({ figures: null, error: "Could not load company sales right now." }),
      ),
    ]);
    if (result.data) {
      return (
        <AdminDashboard
          data={result.data}
          view={view}
          sales={{ ...companySales, period: salesPeriod, years: performanceYears(salesPeriod.year) }}
        />
      );
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

  const sp = await searchParams;
  const param = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const period = resolvePerformancePeriod({
    from: param("from"),
    to: param("to"),
    month: param("month"),
    year: param("year"),
  });
  const years = performanceYears(period.year);

  const [result, performance] = await Promise.all([
    loadUserDashboard(profile.display_name).then(
      (data) => ({ data, error: null }),
      (e: unknown) => ({
        data: null,
        error: e instanceof Error ? e.message : "Could not load your dashboard.",
      }),
    ),
    loadMyPerformance(period).then(
      (data) => ({ data, error: null }),
      () => ({ data: null, error: "Could not load your sales figures right now." }),
    ),
  ]);

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

  return (
    <UserDashboard
      name={profile.display_name}
      data={result.data}
      performance={{ ...performance, period, years }}
    />
  );
}
