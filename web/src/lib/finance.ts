import { createClient } from "@/lib/supabase/server";
import {
  REVENUE_TYPES,
  resolveFinanceRange,
  UUID_RE,
  type FinanceAgent,
  type FinanceDashboard,
  type FinanceFilters,
  type FinanceInvoice,
  type FinanceInvoiceDetail,
  type FinanceTargetRow,
  type MyPerformance,
  type PerformancePeriod,
  type SalesFigures,
} from "@/lib/finance-shared";

export * from "@/lib/finance-shared";

export async function loadFinance(f: FinanceFilters) {
  const supabase = await createClient();
  const range = resolveFinanceRange(f);
  const agent = UUID_RE.test(f.agent) ? f.agent : null;
  const type = (REVENUE_TYPES as readonly string[]).includes(f.type) ? f.type : null;
  const status = f.status === "paid" || f.status === "outstanding" || f.status === "void" ? f.status : null;
  const q = f.q.trim().slice(0, 100) || null;

  const [dashboard, invoices, agents, years] = await Promise.all([
    supabase.rpc("finance_dashboard", {
      p_from: range.from,
      p_to: range.to,
      p_year: range.year,
      p_agent: agent,
    }),
    supabase.rpc("finance_invoice_list", {
      p_from: range.from,
      p_to: range.to,
      p_agent: agent,
      p_type: type,
      p_status: status,
      p_q: q,
      p_limit: 300,
    }),
    supabase.rpc("finance_agents"),
    supabase.rpc("finance_years"),
  ]);

  const error = dashboard.error || invoices.error || agents.error || years.error;
  if (error) throw new Error(error.message);

  return {
    range,
    dashboard: dashboard.data as FinanceDashboard,
    invoices: (invoices.data ?? []) as FinanceInvoice[],
    agents: (agents.data ?? []) as FinanceAgent[],
    years: (years.data ?? []) as number[],
  };
}

export async function loadFinanceAgents() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_agents");
  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceAgent[];
}

export async function loadInvoice(id: string) {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_get_invoice", { p_id: id });
  if (error) throw new Error(error.message);
  return (data ?? null) as FinanceInvoiceDetail | null;
}

export async function loadNextInvoiceNo(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_next_invoice_no", { p_date: date });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

/** The signed-in staff member's own sales and target; null when no finance agent is linked to them. */
export async function loadMyPerformance(period: PerformancePeriod) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_my_performance", {
    p_from: period.from,
    p_to: period.to,
    p_year: period.year,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const perf = data as MyPerformance;
  return {
    ...perf,
    ...salesFigures(perf),
    target: perf.target == null ? null : Number(perf.target),
  };
}

/** Company-wide credited sales for the admin dashboard. */
export async function loadCompanyPerformance(period: PerformancePeriod): Promise<SalesFigures> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_company_performance", {
    p_from: period.from,
    p_to: period.to,
    p_year: period.year,
  });
  if (error) throw new Error(error.message);
  return salesFigures(data as SalesFigures);
}

function salesFigures(f: SalesFigures): SalesFigures {
  return {
    sales_value: Number(f.sales_value),
    invoices: Number(f.invoices),
    quarterly: (f.quarterly ?? []).map(Number),
  };
}

export async function loadTargets(year: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_targets", { p_year: year });
  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceTargetRow[];
}
