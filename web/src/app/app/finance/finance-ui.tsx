import Link from "next/link";
import type { ReactNode } from "react";

export function PaymentBadge({
  amount,
  paid,
  outstanding,
  voided,
}: {
  amount: number;
  paid: number;
  outstanding: number;
  voided?: boolean;
}) {
  const [label, style] = voided
    ? ["Void", "border-[var(--line)] bg-[var(--bg-accent)] text-[var(--muted)] line-through"]
    : amount === 0
      ? ["No charge", "border-[var(--line)] bg-[var(--bg-accent)] text-[var(--muted)]"]
      : outstanding <= 0
        ? ["Paid", "border-emerald-200 bg-emerald-50 text-emerald-800"]
        : paid > 0
          ? ["Part paid", "border-amber-200 bg-amber-50 text-amber-800"]
          : ["Unpaid", "border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] text-[var(--brand)]"];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

export function FinanceHeader({
  title,
  eyebrow = "Finance",
  back,
  subtitle,
  actions,
}: {
  title: ReactNode;
  eyebrow?: string;
  back?: { href: string; label: string };
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--brand)]"
          >
            <span aria-hidden>←</span> {back.label}
          </Link>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-[var(--muted)]">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-deep)] disabled:opacity-60";
export const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-accent)] disabled:opacity-60";
