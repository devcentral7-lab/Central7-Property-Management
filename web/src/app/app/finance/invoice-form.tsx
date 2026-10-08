"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { getNextInvoiceNo, saveInvoice, type InvoiceInput } from "@/app/app/finance/actions";
import {
  CATEGORIES,
  formatLkr,
  REVENUE_TYPES,
  revenueTypeFor,
  todayIso,
  type FinanceAgent,
  type FinanceInvoiceDetail,
} from "@/lib/finance-shared";

const inputClass = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal";
const labelClass = "text-sm font-medium";

type AgentRow = { key: number; agent_id: string; amount: string };

function toAmount(v: string) {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function InvoiceForm({
  agents,
  invoice,
  nextInvoiceNo,
  defaultPropertyRef = "",
}: {
  agents: FinanceAgent[];
  invoice?: FinanceInvoiceDetail | null;
  nextInvoiceNo?: string;
  defaultPropertyRef?: string;
}) {
  const router = useRouter();
  const isNew = !invoice;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [invoiceNo, setInvoiceNo] = useState(invoice?.invoice_no ?? nextInvoiceNo ?? "");
  const invoiceNoEdited = useRef(!isNew);
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date ?? todayIso());
  const [sentDate, setSentDate] = useState(invoice?.sent_date ?? (isNew ? todayIso() : ""));
  const [customer, setCustomer] = useState(invoice?.customer_name ?? "");
  const [address, setAddress] = useState(invoice?.customer_address ?? "");
  const [details, setDetails] = useState(invoice?.details ?? "");
  const [propertyRef, setPropertyRef] = useState(invoice?.property_ref ?? defaultPropertyRef);
  const [category, setCategory] = useState<string>(invoice?.category ?? "C7 Brokering");
  const [revenueType, setRevenueType] = useState<string>(
    invoice?.revenue_type ?? revenueTypeFor("C7 Brokering", ""),
  );
  const typeEdited = useRef(!isNew);
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "");
  const [c7Booking, setC7Booking] = useState(
    invoice?.c7_booking === null || invoice?.c7_booking === undefined ? "" : String(invoice.c7_booking),
  );
  const bookingEdited = useRef(!isNew);
  const [revenueMonth, setRevenueMonth] = useState(
    invoice?.revenue_month ? invoice.revenue_month.slice(0, 7) : todayIso().slice(0, 7),
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  const nextKey = useRef((invoice?.agents.length ?? 0) + 1);
  const [rows, setRows] = useState<AgentRow[]>(() =>
    (invoice?.agents ?? []).map((a, i) => ({ key: i + 1, agent_id: a.agent_id, amount: String(a.amount) })),
  );

  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayIso());
  const [payRef, setPayRef] = useState("");

  const selectable = agents.filter((a) => a.active || rows.some((r) => r.agent_id === a.id));
  const amountNum = toAmount(amount || "0");
  const splitTotal = rows.reduce((s, r) => s + (toAmount(r.amount || "0") || 0), 0);
  const splitDiff = Math.round((amountNum - splitTotal) * 100) / 100;
  const bookable = category === "C7 Brokering" || category === "C7 Management";

  function retype(nextCategory: string, nextDetails: string) {
    if (!typeEdited.current) setRevenueType(revenueTypeFor(nextCategory, nextDetails));
  }

  function onAmount(v: string) {
    setAmount(v);
    if (!bookingEdited.current) setC7Booking(bookable ? v : "");
  }

  function onCategory(v: string) {
    setCategory(v);
    retype(v, details);
    if (!bookingEdited.current) setC7Booking(v === "C7 Brokering" || v === "C7 Management" ? amount : "");
  }

  async function onInvoiceDate(v: string) {
    const yearChanged = v.slice(0, 4) !== invoiceDate.slice(0, 4);
    setInvoiceDate(v);
    if (isNew && !invoiceNoEdited.current && yearChanged && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const next = await getNextInvoiceNo(v);
      if (next && !invoiceNoEdited.current) setInvoiceNo(next);
    }
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.agent_id));
    const first = selectable.find((a) => !used.has(a.id));
    setRows((cur) => [
      ...cur,
      { key: nextKey.current++, agent_id: first?.id ?? "", amount: cur.length ? "" : amount },
    ]);
  }

  function splitEqually() {
    if (!rows.length || !(amountNum > 0)) return;
    const share = Math.floor((amountNum / rows.length) * 100) / 100;
    const last = Math.round((amountNum - share * (rows.length - 1)) * 100) / 100;
    setRows((cur) => cur.map((r, i) => ({ ...r, amount: String(i === cur.length - 1 ? last : share) })));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!invoiceNo.trim()) return setError("Enter an invoice number.");
    if (!(amountNum >= 0) || amount.trim() === "") return setError("Enter the invoice amount.");
    if (rows.some((r) => !r.agent_id)) return setError("Pick an agent for every commission row, or remove the empty row.");
    if (new Set(rows.map((r) => r.agent_id)).size !== rows.length) return setError("Each agent can only appear once.");
    const pay = payNow ? toAmount(payAmount || "0") : 0;
    if (payNow && !(pay > 0)) return setError("Enter the amount received, or untick “Payment received”.");
    if (payNow && pay > amountNum) return setError("The payment can't be more than the invoice amount.");

    const input: InvoiceInput = {
      id: invoice?.id ?? null,
      invoice_no: invoiceNo,
      invoice_date: invoiceDate,
      sent_date: sentDate,
      customer_name: customer,
      customer_address: address,
      details,
      category,
      revenue_type: revenueType,
      amount: amountNum,
      c7_booking: c7Booking.trim() === "" ? null : toAmount(c7Booking),
      revenue_month: revenueMonth,
      property_ref: propertyRef,
      notes,
      agents: rows.map((r) => ({ agent_id: r.agent_id, amount: toAmount(r.amount || "0") || 0 })),
      payment: isNew && payNow ? { amount: pay, paid_on: payDate, reference: payRef } : null,
    };
    startTransition(async () => {
      const result = await saveInvoice(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/app/finance/invoices/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold">Invoice</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>
            Invoice number
            <input
              value={invoiceNo}
              onChange={(e) => {
                invoiceNoEdited.current = true;
                setInvoiceNo(e.target.value);
              }}
              required
              className={`${inputClass} font-semibold`}
            />
          </label>
          <label className={labelClass}>
            Invoice date
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => void onInvoiceDate(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Sent date
            <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Revenue month
            <input
              type="month"
              value={revenueMonth}
              onChange={(e) => setRevenueMonth(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Customer
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Who the invoice is for"
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Property ref <span className="font-normal text-[var(--muted)]">(optional)</span>
            <input
              value={propertyRef}
              onChange={(e) => setPropertyRef(e.target.value.toUpperCase())}
              placeholder="C7-10796"
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Client address <span className="font-normal text-[var(--muted)]">(printed on the invoice)</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder={"No.33, 3/4, Kinrose Ave,\nColombo 04."}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Description of service
            <textarea
              value={details}
              onChange={(e) => {
                setDetails(e.target.value);
                retype(category, e.target.value);
              }}
              rows={3}
              placeholder={"Brokerage Commission - Apartment for Rent in …\nClient: Mr. Wen\nRent Amount: 300,000.00"}
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
              The first line prints in bold with the property ref; extra lines print below it in italics.
            </span>
          </label>
          <label className={labelClass}>
            Category
            <select value={category} onChange={(e) => onCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Revenue type
            <select
              value={revenueType}
              onChange={(e) => {
                typeEdited.current = true;
                setRevenueType(e.target.value);
              }}
              className={inputClass}
            >
              {REVENUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Amount (LKR)
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmount(e.target.value)}
              placeholder="0"
              required
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className={labelClass}>
            C7 booking <span className="font-normal text-[var(--muted)]">(optional)</span>
            <input
              inputMode="decimal"
              value={c7Booking}
              onChange={(e) => {
                bookingEdited.current = true;
                setC7Booking(e.target.value);
              }}
              placeholder={bookable ? "Same as amount" : "—"}
              className={`${inputClass} tabular-nums`}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">Agent commission</h2>
            <p className="text-xs text-[var(--muted)]">Who this invoice is credited to. Leave empty for car park and unassigned income.</p>
          </div>
          <div className="flex gap-2">
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={splitEqually}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)]"
              >
                Split equally
              </button>
            ) : null}
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= selectable.length}
              className="rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-50"
            >
              + Add agent
            </button>
          </div>
        </div>
        {rows.length ? (
          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <select
                  value={r.agent_id}
                  onChange={(e) =>
                    setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, agent_id: e.target.value } : x)))
                  }
                  aria-label="Agent"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Pick an agent…</option>
                  {selectable.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.sales_agent ? "" : " (director)"}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) =>
                    setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))
                  }
                  aria-label="Commission amount"
                  placeholder="Amount"
                  className="w-40 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--brand)]"
                  aria-label="Remove agent"
                >
                  Remove
                </button>
              </div>
            ))}
            <p className={`pt-1 text-xs ${splitDiff !== 0 && amountNum > 0 ? "text-amber-700" : "text-[var(--muted)]"}`}>
              Credited {formatLkr(splitTotal)} of {formatLkr(amountNum || 0)}
              {splitDiff > 0 && amountNum > 0 ? ` · ${formatLkr(splitDiff)} not assigned` : ""}
              {splitDiff < 0 ? ` · ${formatLkr(-splitDiff)} more than the invoice` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No agent credited.</p>
        )}
      </section>

      {isNew ? (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={payNow}
              onChange={(e) => {
                setPayNow(e.target.checked);
                if (e.target.checked && !payAmount) setPayAmount(amount);
              }}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Payment received
          </label>
          {payNow ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Amount received
                <input
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </label>
              <label className={labelClass}>
                Payment date
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} />
              </label>
              <label className={labelClass}>
                Payment ref
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="SD1234567"
                  className={inputClass}
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
        <label className={labelClass}>
          Internal notes <span className="font-normal text-[var(--muted)]">(optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </label>
      </section>

      {error ? (
        <p className="rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] px-4 py-3 text-sm font-medium text-[var(--brand)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={invoice ? `/app/finance/invoices/${invoice.id}` : "/app/finance"}
          className="rounded-xl border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--brand)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : isNew ? "Create invoice" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
