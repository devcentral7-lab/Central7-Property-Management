export type DashboardPeriod = "all" | "month" | "year";

export const DASHBOARD_PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "all", label: "All" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
];

/** `year` is the calendar year shown when `period` is "year"; otherwise the current year. */
export type DashboardRange = { period: DashboardPeriod; year: number };

/** Sri Lanka is UTC+5:30 all year (no DST). */
export const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function colomboYear(now: Date = new Date()): number {
  return new Date(now.getTime() + COLOMBO_OFFSET_MS).getUTCFullYear();
}

/** `?year=YYYY` picks a calendar year, `?period=month|year` the current month or year; no params means All. */
export function parseDashboardRange(
  period: string | undefined,
  year: string | undefined,
  currentYear: number,
): DashboardRange {
  const y = Number(year);
  if (Number.isInteger(y) && y >= 2000 && y <= currentYear) return { period: "year", year: y };
  if (period === "month" || period === "year") return { period, year: currentYear };
  return { period: "all", year: currentYear };
}
