export type DashboardPeriod = "30d" | "month" | "year";

export const DASHBOARD_PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

export function parseDashboardPeriod(v: string | undefined): DashboardPeriod {
  return v === "month" || v === "year" ? v : "30d";
}
