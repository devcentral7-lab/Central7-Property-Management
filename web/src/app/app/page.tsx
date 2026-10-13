import { requireProfile } from "@/lib/auth";
import { loadAdminAnalytics } from "@/lib/analytics";
import { colomboYear, parseDashboardRange } from "@/lib/dashboard-period";
import {
  currentYear,
  loadFinanceSummary,
  loadMyPerformance,
  resolvePerformancePeriod,
  todayIso,
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
    const financeFilter =
      range.period === "all"
        ? { year: "all", month: "" }
        : range.period === "month"
          ? { year: String(range.year), month: String(Number(todayIso().slice(5, 7))) }
          : { year: String(range.year), month: "" };
    const [result, finance] = await Promise.all([
      loadAdminAnalytics(range).then(
        (data) => ({ data, error: null }),
        (e: unknown) => ({
          data: null,
          error: e instanceof Error ? e.message : "Could not load analytics.",
        }),
      ),
      loadFinanceSummary(financeFilter).then(
        ({ dashboard }) => ({
          dashboard,
          query: new URLSearchParams(Object.entries(financeFilter).filter(([, v]) => v)).toString(),
        }),
        () => null,
      ),
    ]);
    if (result.data) {
      return <AdminDashboard data={result.data} view={view} finance={finance} />;
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
  const thisYear = currentYear();
  const years = [...new Set([thisYear + 1, ...Array.from({ length: 6 }, (_, i) => thisYear - i), period.year])].sort(
    (a, b) => b - a,
  );

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
