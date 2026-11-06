import Link from "next/link";
import type { SocialDailyRow } from "@/lib/analytics";
import type { SocialManagerDashboard } from "@/lib/social-dashboard";
import { PeriodSelect } from "@/app/app/dashboard/period-select";
import { BRAND } from "@/app/app/dashboard/palette";

function monthName(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shortDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function Num({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${value ? "" : "text-[var(--muted)]"}`}>
      {value.toLocaleString()}
    </span>
  );
}

const COLS: { key: keyof SocialDailyRow; label: string }[] = [
  { key: "published", label: "Published" },
  { key: "republished", label: "Republished" },
  { key: "drop", label: "Drop" },
  { key: "lost", label: "Lost" },
  { key: "hold", label: "Hold" },
  { key: "closed", label: "Closed" },
  { key: "dataChange", label: "Data change" },
];

export function SocialManagerDashboard({
  name,
  data,
}: {
  name: string;
  data: SocialManagerDashboard;
}) {
  const social = data.socialDaily;
  const last = social[social.length - 1];
  const published = social.reduce((s, r) => s + r.published, 0);
  const republished = social.reduce((s, r) => s + r.republished, 0);
  const remainingPublish = last?.remainingPublish ?? 0;
  const remainingRepublish = last?.remainingRepublish ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--brand-deep)]">
            Welcome Back, {name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Social media queue activity for {data.rangeLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect
            period={data.period}
            year={data.year}
            currentYear={data.currentYear}
            firstYear={data.firstYear}
          />
          <Link
            href="/app/social-queue"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
          >
            Open Social Media Queue
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { label: "Published", value: published, color: BRAND.red },
            { label: "Republished", value: republished, color: BRAND.charcoal },
            { label: "Remaining to publish", value: remainingPublish, color: BRAND.stone },
            { label: "Remaining to republish", value: remainingRepublish, color: BRAND.stoneLight },
          ] as const
        ).map((t) => (
          <div
            key={t.label}
            className="relative flex min-h-[104px] min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] py-3 pl-4 pr-3"
          >
            <span
              aria-hidden
              className="absolute inset-y-3 left-0 w-1 rounded-r-full"
              style={{ background: t.color }}
            />
            <p className="text-xs font-medium text-[var(--muted)] sm:text-[13px]">{t.label}</p>
            <p className="mt-auto pt-2 font-display text-3xl font-semibold tabular-nums">
              {t.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <details
        open
        className="group min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 8a3 3 0 1 0-3-3M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-semibold leading-tight">
              {data.socialUnit === "month"
                ? "Social Media Monthly Activity"
                : "Social Media Daily Activity"}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              {data.rangeLabel} · items marked done on the social media queue, and what was still
              waiting at the end of each {data.socialUnit}
            </span>
          </span>
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
        <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 sm:py-5">
          {social.length ? (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 bg-[var(--card)] pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {data.socialUnit === "month" ? "Month" : "Date"}
                    </th>
                    {COLS.map((c) => (
                      <th
                        key={c.key}
                        className="sticky top-0 bg-[var(--card)] pb-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="sticky top-0 bg-[var(--card)] pb-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Remaining to publish
                    </th>
                    <th className="sticky top-0 bg-[var(--card)] pb-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Remaining to republish
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {social.map((r) => (
                    <tr key={r.day} className="border-t border-[var(--line)] hover:bg-[var(--bg-accent)]/40">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-medium">
                        {data.socialUnit === "month"
                          ? monthName(r.day.slice(0, 7))
                          : shortDate(r.day)}
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className="py-2.5 pr-3 text-right">
                          <Num value={r[c.key] as number} />
                        </td>
                      ))}
                      <td className="py-2.5 pr-3 text-right">
                        <Num value={r.remainingPublish} />
                      </td>
                      <td className="py-2.5 text-right">
                        <Num value={r.remainingRepublish} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--line)]">
                    <td className="pt-2.5 pr-3 font-semibold">Total</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="pt-2.5 pr-3 text-right">
                        <Num value={social.reduce((s, r) => s + (r[c.key] as number), 0)} strong />
                      </td>
                    ))}
                    <td className="whitespace-nowrap pt-2.5 pr-3 text-right">
                      <span className="mr-1 text-xs text-[var(--muted)]">latest</span>
                      <Num value={last?.remainingPublish ?? 0} strong />
                    </td>
                    <td className="whitespace-nowrap pt-2.5 text-right">
                      <span className="mr-1 text-xs text-[var(--muted)]">latest</span>
                      <Num value={last?.remainingRepublish ?? 0} strong />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No social media activity in this period.</p>
          )}
        </div>
      </details>
    </div>
  );
}
