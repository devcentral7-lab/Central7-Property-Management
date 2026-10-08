import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatLkr, loadInvoice, monthLabel } from "@/lib/finance";
import { FinanceHeader, PaymentBadge, secondaryButton } from "@/app/app/finance/finance-ui";
import { AddPaymentForm, DeletePaymentButton, VoidInvoiceButton } from "@/app/app/finance/invoice-actions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");
  const { id } = await params;
  const inv = await loadInvoice(id);
  if (!inv) notFound();

  const voided = Boolean(inv.voided_at);
  const creditedTotal = inv.agents.reduce((s, a) => s + Number(a.amount), 0);
  const revenueMonth = inv.revenue_month
    ? `${monthLabel(Number(inv.revenue_month.slice(5, 7)))} ${inv.revenue_month.slice(0, 4)}`
    : "—";

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <FinanceHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className={voided ? "line-through decoration-2" : ""}>{inv.invoice_no}</span>
            <PaymentBadge amount={inv.amount} paid={inv.paid} outstanding={inv.outstanding} voided={voided} />
          </span>
        }
        eyebrow="Invoice"
        back={{ href: "/app/finance#invoices", label: "Finance" }}
        subtitle={
          <>
            {formatDate(inv.invoice_date)} · {inv.category} · {inv.revenue_type}
          </>
        }
        actions={
          <>
            <a href={`/api/finance/invoices/${inv.id}/download?format=pdf`} download className={secondaryButton}>
              Download PDF
            </a>
            <a href={`/api/finance/invoices/${inv.id}/download?format=xlsx`} download className={secondaryButton}>
              Download Excel
            </a>
            {!voided ? (
              <Link href={`/app/finance/invoices/${inv.id}/edit`} className={secondaryButton}>
                Edit invoice
              </Link>
            ) : null}
            <VoidInvoiceButton
              id={inv.id}
              invoiceNo={inv.invoice_no}
              voided={voided}
              hasPayments={inv.payments.length > 0}
            />
          </>
        }
      />

      {voided ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--bg-accent)] px-4 py-3 text-sm">
          Voided{inv.voided_by_name ? ` by ${inv.voided_by_name}` : ""} on {formatDate(inv.voided_at)}
          {inv.void_reason ? ` — ${inv.void_reason}` : ""}. It&apos;s left out of all finance totals.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Invoiced", value: inv.amount, color: "var(--ink)", bar: "#1f1f1f" },
          { label: "Received", value: inv.paid, color: "#047857", bar: "#10b981" },
          {
            label: "Outstanding",
            value: inv.outstanding,
            color: inv.outstanding > 0 ? "var(--brand)" : "var(--muted)",
            bar: inv.outstanding > 0 ? "#c8102e" : "#e7e5e4",
          },
        ].map((t) => (
          <div
            key={t.label}
            className="relative flex min-h-[92px] flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] py-3 pl-4 pr-3"
          >
            <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: t.bar }} />
            <p className="text-xs font-medium text-[var(--muted)] sm:text-[13px]">{t.label}</p>
            <p className="mt-auto pt-2 font-display text-2xl font-semibold tabular-nums sm:text-3xl" style={{ color: t.color }}>
              {formatLkr(t.value)}
            </p>
          </div>
        ))}
      </div>

      <Card title="Details">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer">{inv.customer_name || "—"}</Field>
          <Field label="Client address">
            {inv.customer_address ? <span className="whitespace-pre-line">{inv.customer_address}</span> : "—"}
          </Field>
          <Field label="Sent">{formatDate(inv.sent_date)}</Field>
          <Field label="Revenue month">{revenueMonth}</Field>
          <Field label="Property">
            {inv.property_ref ? <PropertyLink refNo={inv.property_ref}>{inv.property_ref}</PropertyLink> : "—"}
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Description of service">
              <span className="whitespace-pre-line">{inv.details || "—"}</span>
            </Field>
          </div>
          <Field label="C7 booking">{inv.c7_booking === null ? "—" : formatLkr(inv.c7_booking)}</Field>
          <Field label="Category">{inv.category}</Field>
          <Field label="Revenue type">{inv.revenue_type}</Field>
          <Field label="Source">
            {inv.legacy_sheet ? `Imported from INVOICE Tracker (${inv.legacy_sheet})` : `Created${inv.created_by_name ? ` by ${inv.created_by_name}` : ""}`}
          </Field>
          {inv.notes ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Internal notes">{inv.notes}</Field>
            </div>
          ) : null}
          {inv.updated_by_name ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-[var(--muted)]">
                Last changed by {inv.updated_by_name} on {formatDate(inv.updated_at)}
              </p>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card
        title="Agent commission"
        aside={
          inv.agents.length ? (
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {formatLkr(creditedTotal)} credited
            </span>
          ) : null
        }
      >
        {inv.agents.length ? (
          <ul className="divide-y divide-[var(--line)]">
            {inv.agents.map((a) => (
              <li key={a.agent_id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-accent)] text-xs font-semibold">
                    {a.name.slice(0, 1).toUpperCase()}
                  </span>
                  {a.name}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatLkr(a.amount)}
                  {inv.amount > 0 ? (
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                      {Math.round((Number(a.amount) / inv.amount) * 100)}%
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">Not credited to any agent.</p>
        )}
      </Card>

      <Card
        title="Payments"
        aside={!voided && inv.outstanding > 0 ? null : (
          <span className="text-xs text-[var(--muted)]">
            {voided ? "Invoice is void" : inv.amount > 0 ? "Fully paid" : ""}
          </span>
        )}
      >
        {inv.payments.length ? (
          <ul className="divide-y divide-[var(--line)]">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular-nums">{formatLkr(p.amount)}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.paid_on ? formatDate(p.paid_on) : "Date not recorded"}
                    {p.reference ? ` · Ref ${p.reference}` : ""}
                    {p.created_by_name ? ` · added by ${p.created_by_name}` : ""}
                  </p>
                  {p.notes ? <p className="mt-0.5 text-xs">{p.notes}</p> : null}
                </div>
                <DeletePaymentButton id={p.id} invoiceId={inv.id} invoiceNo={inv.invoice_no} amount={p.amount} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No payments recorded yet.</p>
        )}
        {!voided && inv.outstanding > 0 ? (
          <div className="mt-4 flex">
            <AddPaymentForm invoiceId={inv.id} invoiceNo={inv.invoice_no} outstanding={inv.outstanding} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
