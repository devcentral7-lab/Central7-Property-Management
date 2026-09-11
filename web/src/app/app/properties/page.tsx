import Link from "next/link";
import { PAGE_SIZE, PROPERTY_TYPES, STATUS_LIST } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCard } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const status = one(sp.status);
  const propertyType = one(sp.property_type);
  const city = one(sp.city).trim();
  const page = Math.max(1, Number(one(sp.page) || "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("property_list_cards")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (propertyType) query = query.eq("property_type", propertyType);
  if (city) query = query.ilike("city", `%${city}%`);
  if (q) {
    query = query.or(
      `ref_no.ilike.%${q}%,contact_name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-[var(--danger)]">{error.message}</p>
    );
  }

  const rows = (data ?? []) as PropertyCard[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (propertyType) params.set("property_type", propertyType);
    if (city) params.set("city", city);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/app/properties?${s}` : "/app/properties";
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Properties</h1>
          <p className="text-sm text-[var(--muted)]">
            {total.toLocaleString()} matches · page {page} of {totalPages} · {PAGE_SIZE} per page
          </p>
        </div>
        <Link
          href="/app/properties/new"
          className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Add listing
        </Link>
      </div>

      <form className="mt-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 md:grid-cols-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Ref, contact, address…"
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm md:col-span-2"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="property_type"
          defaultValue={propertyType}
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            name="city"
            defaultValue={city}
            placeholder="City"
            className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--brand-deep)] px-4 text-sm font-semibold text-white"
          >
            Go
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Agent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/app/properties/${r.ref_no}`}
                    className="font-semibold text-[var(--brand-deep)] hover:underline"
                  >
                    {r.ref_no}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.property_type}
                  <span className="block text-xs text-[var(--muted)]">
                    {r.opportunity_type}
                  </span>
                </td>
                <td className="px-4 py-3">{r.city || "—"}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3">
                  {formatMoney(r.price_total, r.currency)}
                </td>
                <td className="px-4 py-3">{r.created_by_name || "—"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  No properties match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          className={`text-sm font-medium ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
        >
          ← Previous
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          className={`text-sm font-medium ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
