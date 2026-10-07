import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LinkRow } from "@/components/clickable-row";
import { LiveFilterForm } from "@/components/live-filter-form";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { BRAND, seriesColor } from "@/app/app/dashboard/palette";
import { requireProfile } from "@/lib/auth";
import {
  currentYear,
  formatDate,
  formatLkr,
  loadFinance,
  monthLabel,
  REVENUE_TYPES,
  type FinanceFilters,
} from "@/lib/finance";
import { FinanceHeader, PaymentBadge, primaryButton, secondaryButton } from "./finance-ui";
import { QuarterlyChart } from "./quarterly-chart";
import { RevenueSummary, TYPE_COLOR } from "./revenue-summary";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const inputClass = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal";

type IconName = "filter" | "wallet" | "user" | "chart" | "table" | "receipt";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, string> = {
    filter: "M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z",
    wallet: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h3",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    table: "M3 5h18v14H3zM3 10h18M9 10v9",
    receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h3",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Section({
  title,
  subtitle,
  icon,
  aside,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  aside?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <details
      open
      id={id}
      className="group min-w-0 scroll-mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
          <Icon name={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold leading-tight">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-[var(--muted)]">{subtitle}</span> : null}
        </span>
        {aside}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </details>
  );
}

const th = "whitespace-nowrap pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]";
const td = "py-2.5 pr-3";
const num = "py-2.5 pr-3 text-right tabular-nums whitespace-nowrap";

function qs(params: Record<string, string>) {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const sp = await searchParams;
  const filters: FinanceFilters = {
    agent: one(sp.agent),
    year: one(sp.year) || String(currentYear()),
    quarter: one(sp.quarter),
    month: one(sp.month),
    from: one(sp.from),
    to: one(sp.to),
    type: one(sp.type),
    status: one(sp.status),
    q: one(sp.q),
  };

  let data: Awaited<ReturnType<typeof loadFinance>>;
  try {
    data = await loadFinance(filters);
  } catch (e) {
    return <p className="text-[var(--danger)]">{e instanceof Error ? e.message : "Could not load finance data"}</p>;
  }
  const { range, dashboard, invoices, agents, years } = data;
  const agentName = agents.find((a) => a.id === filters.agent)?.name;

  const salesAgents = [...new Set(dashboard.quarterly.map((r) => r.agent))].sort();
  const quarterly: Record<string, Record<number, number>> = {};
  for (const r of dashboard.quarterly) {
    quarterly[r.agent] ??= {};
    quarterly[r.agent][r.quarter] = Number(r.amount);
  }

  const catYears = [...new Set(dashboard.by_category_year.map((r) => r.year))].sort((a, b) => b - a);
  const categories = [...new Set(dashboard.by_category_year.map((r) => r.category))].sort();
  const catAmount = (cat: string, y: number) =>
    Number(dashboard.by_category_year.find((r) => r.category === cat && r.year === y)?.amount ?? 0);

  const baseParams: Record<string, string> = {
    agent: filters.agent,
    year: filters.year,
    quarter: filters.quarter,
    month: filters.month,
    from: filters.from,
    to: filters.to,
  };
  const yearOptions = [...new Set([currentYear(), ...years])].sort((a, b) => b - a);
  const period = `${range.label}${agentName ? ` · ${agentName}` : ""}`;

  return (
    <div className="space-y-4 sm:space-y-5">
      <FinanceHeader
        eyebrow="Admin"
        title="Finance"
        subtitle={<>Invoices, payments and agent commission · {period}</>}
        actions={
          <>
            <Link href="/app/finance/settings" className={secondaryButton}>
              Targets &amp; agents
            </Link>
            <Link href="/app/finance/invoices/new" className={primaryButton}>
              + New invoice
            </Link>
          </>
        }
      />

      <LiveFilterForm action="/app/finance" className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium">
            User
            <select name="agent" defaultValue={filters.agent} className={inputClass}>
              <option value="">All users</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Year
            <select
              name="year"
              defaultValue={filters.year}
              data-default-value={String(currentYear())}
              className={inputClass}
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
              <option value="all">All years</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Quarter
            <select name="quarter" defaultValue={filters.quarter} className={inputClass}>
              <option value="">All quarters</option>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={String(q)}>
                  Q{q}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Month
            <select name="month" defaultValue={filters.month} className={inputClass}>
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m)}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Date from
            <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Date to
            <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Type
            <select name="type" defaultValue={filters.type} className={inputClass}>
              <option value="">All types</option>
              {REVENUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Payment
            <select name="status" defaultValue={filters.status} className={inputClass}>
              <option value="">All</option>
              <option value="outstanding">Outstanding</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </label>
          <label className="col-span-2 text-sm font-medium md:col-span-3">
            Search invoices
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Invoice no, customer, details, C7 ref…"
              className={inputClass}
            />
          </label>
          <div className="col-span-2 flex items-end md:col-span-1">
            <button
              type="reset"
              className="w-full rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
            >
              Clear filters
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Date from / to override year, quarter and month ·{" "}
          <span className="font-semibold text-[var(--ink)]">{dashboard.invoice_count}</span> invoice(s) in this period
        </p>
      </LiveFilterForm>

      <Section
        title="Sale, Rental & Fees"
        subtitle={agentName ? `${period} · amounts are ${agentName}'s commission share` : period}
        icon="wallet"
      >
        <RevenueSummary
          dashboard={dashboard}
          typeHref={(type) => `/app/finance${qs({ ...baseParams, type })}#invoices`}
          outstandingHref={`/app/finance${qs({ ...baseParams, status: "outstanding" })}#invoices`}
        />
      </Section>

      <Section title={`By Agent — Targets ${range.year}`} subtitle="Commission credited per agent" icon="user">
        {dashboard.by_agent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className={th}>Agent</th>
                  <th className={`${th} text-right`}>Invoices</th>
                  <th className={`${th} text-right`}>Sale</th>
                  <th className={`${th} text-right`}>Rental</th>
                  <th className={`${th} text-right`}>Other</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Target</th>
                  <th className={`${th} text-right`}>Remaining</th>
                  <th className={th}>Achieved</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.by_agent.map((a) => {
                  const target = a.target === null ? null : Number(a.target);
                  const achieved = target ? Math.round((Number(a.total) / target) * 100) : null;
                  return (
                    <tr key={a.id} className="border-t border-[var(--line)]">
                      <td className={td}>
                        <Link
                          href={`/app/finance${qs({ ...baseParams, agent: a.id })}`}
                          className="inline-flex items-center gap-2 font-medium hover:text-[var(--brand)] hover:underline"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-accent)] text-xs font-semibold text-[var(--ink)]">
                            {a.name.slice(0, 1).toUpperCase()}
                          </span>
                          {a.name}
                        </Link>
                      </td>
                      <td className={num}>{a.invoices}</td>
                      <td className={num}>{formatLkr(a.sale)}</td>
                      <td className={num}>{formatLkr(a.rental)}</td>
                      <td className={num}>{formatLkr(a.other)}</td>
                      <td className={`${num} font-semibold`}>{formatLkr(a.total)}</td>
                      <td className={`${num} text-[var(--muted)]`}>{target === null ? "—" : formatLkr(target)}</td>
                      <td className={`${num} text-[var(--muted)]`}>
                        {target === null ? "—" : formatLkr(Math.max(target - Number(a.total), 0))}
                      </td>
                      <td className="py-2.5">
                        {achieved === null ? (
                          <span className="text-[var(--muted)]">—</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-accent)]">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.min(achieved, 100)}%`,
                                  background: achieved >= 100 ? BRAND.active : BRAND.red,
                                }}
                              />
                            </span>
                            <span className="text-xs font-semibold tabular-nums">{achieved}%</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No agent commission in this period.</p>
        )}
      </Section>

      <Section
        title={`Quarterly Performance — ${range.year}`}
        subtitle="Commission per sales agent each quarter (directors excluded)"
        icon="chart"
      >
        {salesAgents.length ? (
          <QuarterlyChart
            agents={salesAgents}
            colors={salesAgents.map((_, i) => seriesColor(i))}
            values={quarterly}
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">No sales agent commission in {range.year}.</p>
        )}
      </Section>

      <Section
        title="By Category"
        subtitle={agentName ? `${agentName}'s commission share per year` : "Invoiced per year"}
        icon="table"
      >
        {catYears.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className={th}>Category</th>
                  {catYears.map((y) => (
                    <th key={y} className={`${th} text-right`}>
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c} className="border-t border-[var(--line)]">
                    <td className={`${td} font-medium`}>{c}</td>
                    {catYears.map((y) => {
                      const v = catAmount(c, y);
                      return (
                        <td key={y} className={`${num} ${v ? "" : "text-[var(--muted)]/50"}`}>
                          {formatLkr(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)]">
                  <td className="pt-2.5 pr-3 font-semibold">Total</td>
                  {catYears.map((y) => (
                    <td key={y} className="whitespace-nowrap pt-2.5 pr-3 text-right font-semibold tabular-nums">
                      {formatLkr(categories.reduce((s, c) => s + catAmount(c, y), 0))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
        )}
      </Section>

      <Section
        id="invoices"
        title="Invoices"
        subtitle={`${period}${filters.type ? ` · ${filters.type}` : ""}${
          filters.status
            ? ` · ${filters.status === "paid" ? "Paid" : filters.status === "void" ? "Void" : "Outstanding"}`
            : ""
        }`}
        icon="receipt"
        aside={
          <span className="hidden rounded-full bg-[var(--bg-accent)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--ink)] sm:inline">
            {invoices.length}
            {invoices.length === 300 ? "+" : ""} invoices
          </span>
        }
      >
        <ul className="-my-3 divide-y divide-[var(--line)] md:hidden">
          {invoices.map((inv) => (
            <LinkRow key={inv.id} href={`/app/finance/invoices/${inv.id}`} as="li" className="-mx-2 rounded-lg px-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{inv.invoice_no}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatDate(inv.invoice_date)} · {inv.revenue_type}
                  </p>
                </div>
                <PaymentBadge amount={inv.amount} paid={inv.paid} outstanding={inv.outstanding} voided={Boolean(inv.voided_at)} />
              </div>
              {inv.customer_name ? <p className="mt-1 text-sm font-medium">{inv.customer_name}</p> : null}
              <p className="text-xs text-[var(--muted)]">{inv.details}</p>
              <p className="mt-1 text-sm tabular-nums">
                <span className="font-semibold">{formatLkr(inv.amount)}</span>
                {inv.outstanding > 0 ? (
                  <span className="text-[var(--brand)]"> · {formatLkr(inv.outstanding)} due</span>
                ) : null}
              </p>
            </LinkRow>
          ))}
          {!invoices.length ? (
            <li className="py-6 text-center text-sm text-[var(--muted)]">No invoices match these filters.</li>
          ) : null}
        </ul>

        <div className="hidden max-h-[40rem] overflow-auto md:block">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="text-left">
                {[
                  ["Date", ""],
                  ["Invoice", ""],
                  ["Customer / details", ""],
                  ["Type", ""],
                  ["Agents", ""],
                  ["Amount", "text-right"],
                  ["Received", "text-right"],
                  ["Outstanding", "text-right"],
                  ["Status", ""],
                ].map(([h, align]) => (
                  <th key={h} className={`${th} sticky top-0 z-[1] bg-[var(--card)] ${align}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <LinkRow key={inv.id} href={`/app/finance/invoices/${inv.id}`} className="border-t border-[var(--line)] align-top">
                  <td className={`${td} whitespace-nowrap text-xs text-[var(--muted)]`}>{formatDate(inv.invoice_date)}</td>
                  <td className={`${td} whitespace-nowrap font-semibold`}>{inv.invoice_no}</td>
                  <td className={`${td} max-w-md`}>
                    {inv.customer_name ? <p className="font-medium">{inv.customer_name}</p> : null}
                    <p className="text-xs text-[var(--muted)]">{inv.details}</p>
                    {inv.property_ref ? (
                      <p className="mt-0.5 text-xs">
                        <PropertyLink refNo={inv.property_ref}>{inv.property_ref}</PropertyLink>
                      </p>
                    ) : null}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[inv.revenue_type] }} aria-hidden />
                      {inv.revenue_type}
                    </span>
                  </td>
                  <td className={`${td} text-xs`}>
                    {inv.agents.length
                      ? inv.agents.map((a) => (
                          <span key={a.name} className="block whitespace-nowrap">
                            {a.name}
                            {inv.agents.length > 1 ? (
                              <span className="tabular-nums text-[var(--muted)]"> · {formatLkr(a.amount)}</span>
                            ) : null}
                          </span>
                        ))
                      : <span className="text-[var(--muted)]">—</span>}
                  </td>
                  <td className={`${num} font-semibold`}>{formatLkr(inv.amount)}</td>
                  <td className={num}>
                    {formatLkr(inv.paid)}
                    {inv.last_paid_on ? (
                      <span className="block text-xs text-[var(--muted)]">{formatDate(inv.last_paid_on)}</span>
                    ) : null}
                  </td>
                  <td className={`${num} ${inv.outstanding > 0 ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]/50"}`}>
                    {formatLkr(inv.outstanding)}
                  </td>
                  <td className="py-2.5">
                    <PaymentBadge amount={inv.amount} paid={inv.paid} outstanding={inv.outstanding} voided={Boolean(inv.voided_at)} />
                  </td>
                </LinkRow>
              ))}
              {!invoices.length ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-[var(--muted)]">
                    No invoices match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
