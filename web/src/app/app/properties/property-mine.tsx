import Link from "next/link";
import { PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCard } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  target: string;
  page: number;
  isAdmin: boolean;
  /** Standalone page instead of the Properties "mine" tab. */
  standalone?: boolean;
};

export async function PropertyMinePanel({ target, page, isAdmin, standalone = false }: Props) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("property_list_cards")
    .select("*", { count: "exact" })
    .eq("created_by_name", target)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return <p className="text-[var(--danger)]">{error.message}</p>;
  }

  const rows = (data ?? []) as PropertyCard[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    if (!standalone) params.set("tab", "mine");
    if (p > 1) params.set("page", String(p));
    if (isAdmin) params.set("user", target);
    const qs = params.toString();
    const base = standalone ? "/app/my-properties" : "/app/properties";
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div>
      <p className="text-sm text-[var(--muted)]">
        Showing listings for <strong>{target}</strong> ·{" "}
        {total.toLocaleString()} total · page {page} of {totalPages}
      </p>

      {isAdmin ? (
        <form className="mt-4 flex gap-2">
          {standalone ? null : <input type="hidden" name="tab" value="mine" />}
          <input
            name="user"
            defaultValue={target}
            placeholder="Staff name"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm sm:max-w-xs sm:flex-none"
          />
          <button className="shrink-0 rounded-xl bg-[var(--brand-deep)] px-4 text-sm font-semibold text-white">
            View
          </button>
        </form>
      ) : null}

      <ul className="mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] md:hidden">
        {rows.map((r) => (
          <PropertyRow key={r.id} refNo={r.ref_no} as="li" className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
              <StatusBadge status={r.status} className="shrink-0 text-xs" />
            </div>
            <p className="mt-1 text-sm">
              {r.property_type} · {r.opportunity_type} · {r.city || "—"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">
                {formatMoney(r.price_total, r.currency)}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {r.bedrooms ?? "—"} bd / {r.bathrooms ?? "—"} ba ·{" "}
                {formatDate(r.created_at)}
              </span>
            </div>
          </PropertyRow>
        ))}
        {!rows.length ? (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No listings.
          </li>
        ) : null}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Beds / Baths</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PropertyRow
                key={r.id}
                refNo={r.ref_no}
                className="border-b border-[var(--line)] last:border-0"
              >
                <td className="px-4 py-3">
                  <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
                </td>
                <td className="px-4 py-3">
                  {r.property_type}
                  <span className="block text-xs text-[var(--muted)]">
                    {r.opportunity_type}
                  </span>
                </td>
                <td className="px-4 py-3">{r.city || "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  {r.bedrooms ?? "—"} / {r.bathrooms ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {formatMoney(r.price_total, r.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                  {formatDate(r.created_at)}
                </td>
              </PropertyRow>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  No listings.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          className={`-ml-2 rounded-lg px-2 py-2 text-sm font-medium ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
        >
          ← Previous
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          className={`-mr-2 rounded-lg px-2 py-2 text-sm font-medium ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
