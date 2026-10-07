"use client";

import { useState, useTransition } from "react";
import { addPayment, deletePayment, setInvoiceVoid } from "@/app/app/finance/actions";
import { formatLkr, todayIso } from "@/lib/finance-shared";

const inputClass = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal";

export function AddPaymentForm({
  invoiceId,
  invoiceNo,
  outstanding,
}: {
  invoiceId: string;
  invoiceNo: string;
  outstanding: number;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(outstanding));
  const [paidOn, setPaidOn] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setAmount(String(outstanding));
          setOpen(true);
        }}
        className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-deep)]"
      >
        + Record payment
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount.replace(/,/g, ""));
    if (!(value > 0)) return setError("Enter the amount received.");
    if (value > outstanding + 0.005) return setError(`That's more than the ${formatLkr(outstanding)} outstanding.`);
    startTransition(async () => {
      const result = await addPayment({
        invoice_id: invoiceId,
        invoice_no: invoiceNo,
        amount: value,
        paid_on: paidOn,
        reference,
        notes,
      });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setReference("");
      setNotes("");
    });
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-accent)]/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Amount received
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <label className="text-sm font-medium">
          Payment date
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Payment ref
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="SD1234567" className={inputClass} />
        </label>
        <label className="text-sm font-medium sm:col-span-3">
          Notes <span className="font-normal text-[var(--muted)]">(optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm font-medium text-[var(--brand)]">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save payment"}
        </button>
      </div>
    </form>
  );
}

export function DeletePaymentButton({
  id,
  invoiceId,
  invoiceNo,
  amount,
}: {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove the ${formatLkr(amount)} payment from ${invoiceNo}?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deletePayment({ id, invoice_id: invoiceId, invoice_no: invoiceNo, amount });
            if (!result.ok) setError(result.error);
          });
        }}
        className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--brand)] disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? <span className="text-xs text-[var(--brand)]">{error}</span> : null}
    </span>
  );
}

export function VoidInvoiceButton({
  id,
  invoiceNo,
  voided,
  hasPayments,
}: {
  id: string;
  invoiceNo: string;
  voided: boolean;
  hasPayments: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    let reason = "";
    if (!voided) {
      const answer = window.prompt(
        `Void invoice ${invoiceNo}? It will be left out of all totals.${
          hasPayments ? " Its recorded payments stay on the invoice." : ""
        }\n\nReason (optional):`,
      );
      if (answer === null) return;
      reason = answer;
    }
    setError(null);
    startTransition(async () => {
      const result = await setInvoiceVoid(id, invoiceNo, !voided, reason);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
          voided
            ? "border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--bg-accent)]"
            : "border-[var(--brand)]/30 bg-[var(--card)] text-[var(--brand)] hover:bg-[var(--brand)]/[0.05]"
        }`}
      >
        {pending ? "Saving…" : voided ? "Restore invoice" : "Void invoice"}
      </button>
      {error ? <span className="mt-1 text-xs text-[var(--brand)]">{error}</span> : null}
    </span>
  );
}
