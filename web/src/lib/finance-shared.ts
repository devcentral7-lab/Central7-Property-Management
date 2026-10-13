/** Finance types and pure helpers, safe to import from client components. */

export const REVENUE_TYPES = ["Sale", "Rental", "Management Fee", "Car Park", "Other"] as const;
export type RevenueType = (typeof REVENUE_TYPES)[number];

export const CATEGORIES = ["C7 Brokering", "C7 Management", "Car Park", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export type FinanceAgent = {
  id: string;
  name: string;
  sales_agent: boolean;
  active: boolean;
  profile_id: string | null;
  profile_name: string | null;
  invoices: number;
};

export type FinancePayment = {
  id: string;
  paid_on: string | null;
  amount: number;
  reference: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type FinanceInvoiceDetail = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  sent_date: string | null;
  customer_name: string | null;
  customer_address: string | null;
  details: string;
  category: Category;
  revenue_type: RevenueType;
  amount: number;
  c7_booking: number | null;
  revenue_month: string | null;
  property_ref: string | null;
  notes: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  legacy_sheet: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_by_name: string | null;
  updated_at: string;
  paid: number;
  outstanding: number;
  last_paid_on: string | null;
  payments: FinancePayment[];
  agents: { agent_id: string; name: string; amount: number }[];
};

export type FinanceTargetRow = {
  agent_id: string;
  name: string;
  active: boolean;
  target: number | null;
  previous_target: number | null;
  achieved: number;
};

export type FinanceDashboard = {
  invoice_count: number;
  totals: { invoiced: number; received: number; outstanding: number };
  by_type: { type: RevenueType; count: number; amount: number }[];
  by_agent: {
    id: string;
    name: string;
    sales_agent: boolean;
    invoices: number;
    sale: number;
    rental: number;
    other: number;
    total: number;
    target: number | null;
  }[];
  by_category_year: { year: number; category: string; amount: number }[];
  quarterly: { agent: string; quarter: number; amount: number }[];
};

export type SalesFigures = {
  sales_value: number;
  invoices: number;
  /** Credited sales for Q1–Q4 of the chosen year. */
  quarterly: number[];
};

/** A staff member's own figures for their dashboard (from finance_my_performance). */
export type MyPerformance = SalesFigures & {
  agent: string;
  target: number | null;
};

/** Year choices for the performance filters: next year back to five years ago, plus the selected one. */
export function performanceYears(selected: number) {
  const thisYear = currentYear();
  return [...new Set([thisYear + 1, ...Array.from({ length: 6 }, (_, i) => thisYear - i), selected])].sort(
    (a, b) => b - a,
  );
}

export type PerformancePeriod = {
  from: string;
  to: string;
  /** "" means the whole year. */
  month: string;
  year: number;
  label: string;
};

export function currentMonth() {
  return Number(todayIso().slice(5, 7));
}

function monthOrYearRange(year: number, month: number) {
  return month >= 1 && month <= 12
    ? { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay(year, month))}` }
    : { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Month / Year pick the range; valid From / To dates override it. Defaults to this month. */
export function resolvePerformancePeriod(p: {
  from?: string;
  to?: string;
  month?: string;
  year?: string;
}): PerformancePeriod {
  const thisYear = currentYear();
  const parsedYear = Number(p.year);
  const year = parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : thisYear;
  const monthNum = p.month === undefined ? currentMonth() : Number(p.month);
  const month = monthNum >= 1 && monthNum <= 12 ? String(monthNum) : "";
  const base = monthOrYearRange(year, Number(month));
  let from = p.from && DATE_RE.test(p.from) ? p.from : base.from;
  let to = p.to && DATE_RE.test(p.to) ? p.to : base.to;
  if (from > to) [from, to] = [to, from];
  const label =
    from === base.from && to === base.to
      ? month
        ? `${MONTH_NAMES[Number(month) - 1]} ${year}`
        : `All of ${year}`
      : `${formatDate(from)} – ${formatDate(to)}`;
  return { from, to, month, year, label };
}

export function monthRangeFor(year: number, month: string) {
  return monthOrYearRange(year, Number(month));
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type FinanceInvoice = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  sent_date: string | null;
  customer_name: string | null;
  details: string;
  category: string;
  revenue_type: RevenueType;
  amount: number;
  paid: number;
  outstanding: number;
  last_paid_on: string | null;
  property_ref: string | null;
  voided_at: string | null;
  agents: { name: string; amount: number }[];
};

export type FinanceFilters = {
  agent: string;
  year: string;
  quarter: string;
  month: string;
  from: string;
  to: string;
  type: string;
  status: string;
  q: string;
};

export type FinanceRange = {
  from: string;
  to: string;
  /** Year used for targets and the quarterly chart. */
  year: number;
  label: string;
};

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(m: number) {
  return MONTHS[m - 1] ?? "";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function currentYear() {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric" }).format(new Date()),
  );
}

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${monthLabel(m)} ${y}`;
}

export function formatLkr(n: number | null | undefined) {
  return `LKR ${Math.round(Number(n ?? 0)).toLocaleString("en-US")}`;
}

/** Default revenue type for a category; brokering guesses from the details. */
export function revenueTypeFor(category: string, details: string): RevenueType {
  if (category === "Car Park") return "Car Park";
  if (category === "C7 Management") return "Management Fee";
  if (category === "Other") return "Other";
  if (/\b(sale|sold|selling|purchase|buy)/i.test(details)) return "Sale";
  if (/\b(rent|rental|lease|leasing)/i.test(details)) return "Rental";
  return "Other";
}

/** Date From / To override Year, Quarter and Month. */
export function resolveFinanceRange(f: FinanceFilters): FinanceRange {
  const from = DATE_RE.test(f.from) ? f.from : "";
  const to = DATE_RE.test(f.to) ? f.to : "";
  if (from || to) {
    const start = from || "2000-01-01";
    const end = to || "2100-12-31";
    const [a, b] = start <= end ? [start, end] : [end, start];
    return {
      from: a,
      to: b,
      year: Number((from || to).slice(0, 4)),
      label: from && to ? `${a} to ${b}` : from ? `from ${a}` : `until ${b}`,
    };
  }

  if (f.year === "all") {
    return { from: "2000-01-01", to: "2100-12-31", year: currentYear(), label: "All years" };
  }

  const year = /^\d{4}$/.test(f.year) ? Number(f.year) : currentYear();
  const month = Number(f.month);
  if (month >= 1 && month <= 12) {
    return {
      from: `${year}-${pad(month)}-01`,
      to: `${year}-${pad(month)}-${pad(lastDay(year, month))}`,
      year,
      label: `${monthLabel(month)} ${year}`,
    };
  }
  const quarter = Number(f.quarter);
  if (quarter >= 1 && quarter <= 4) {
    const m1 = (quarter - 1) * 3 + 1;
    const m3 = m1 + 2;
    return {
      from: `${year}-${pad(m1)}-01`,
      to: `${year}-${pad(m3)}-${pad(lastDay(year, m3))}`,
      year,
      label: `Q${quarter} ${year}`,
    };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31`, year, label: String(year) };
}
