import Link from "next/link";
import { PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCard } from "@/lib/types";
import { PropertyLink } from "@/app/app/properties/property-modal";

type Props = {
  target: string;
  page: number;
  isAdmin: boolean;
};

export async function PropertyMinePanel({ target, page, isAdmin }: Props) {
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

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    params.set("tab", "mine");
    if (p > 1) params.set("page", String(p));
    if (isAdmin) params.set("user", target);
    return `/app/properties?${params.toString()}`;
  }

  return (
    <div>
      <p className="text-sm text-[var(--muted)]">
        Showing listings for <strong>{target}</strong> · {total} total · page{" "}
        {page}
      </p>

      {isAdmin ? (
        <form className="mt-4 flex gap-2">
          <input type="hidden" name="tab" value="mine" />
          <input
            name="user"
            defaultValue={target}
            placeholder="Staff name"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-[var(--brand-deep)] px-4 text-sm font-semibold text-white">
            View
          </button>
        </form>
      ) : null}

      <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <PropertyLink refNo={r.ref_no}>{r.ref_no}</PropertyLink>
              <p className="text-sm text-[var(--muted)]">
                {r.property_type} · {r.city || "—"} · {r.status}
              </p>
            </div>
            <span className="text-sm">
              {r.price_total != null
                ? `${r.currency} ${Number(r.price_total).toLocaleString()}`
                : "—"}
            </span>
          </li>
        ))}
        {!rows.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No listings.
          </li>
        ) : null}
      </ul>

      <div className="mt-4 flex justify-between text-sm">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          className={page <= 1 ? "pointer-events-none opacity-40" : ""}
        >
          ← Previous
        </Link>
        <Link href={hrefFor(page + 1)}>Next →</Link>
      </div>
    </div>
  );
}
