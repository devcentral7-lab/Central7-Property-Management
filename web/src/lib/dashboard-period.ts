export type DashboardPeriod = "30d" | "month" | "year";

export const DASHBOARD_PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "30d", label: "Last 30 Days" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
];

export function parseDashboardPeriod(v: string | undefined): DashboardPeriod {
  return v === "month" || v === "year" ? v : "30d";
}
