import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { PropertyCard } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyPropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const target =
    profile.role === "Admin" && typeof sp.user === "string" && sp.user
      ? sp.user
      : profile.display_name;
  const page = Math.max(1, Number((typeof sp.page === "string" && sp.page) || "1") || 1);
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

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">My properties</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Showing listings for <strong>{target}</strong> · {total} total · page {page}
      </p>

      {profile.role === "Admin" ? (
        <form className="mt-4 flex gap-2">
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
          <li key={r.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link
                href={`/app/properties/${r.ref_no}`}
                className="font-semibold text-[var(--brand-deep)] hover:underline"
              >
                {r.ref_no}
              </Link>
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
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">No listings.</li>
        ) : null}
      </ul>

      <div className="mt-4 flex justify-between text-sm">
        <Link
          href={
            page > 1
              ? `/app/my-properties?page=${page - 1}${profile.role === "Admin" ? `&user=${encodeURIComponent(target)}` : ""}`
              : "#"
          }
          className={page <= 1 ? "pointer-events-none opacity-40" : ""}
        >
          ← Previous
        </Link>
        <Link
          href={`/app/my-properties?page=${page + 1}${profile.role === "Admin" ? `&user=${encodeURIComponent(target)}` : ""}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
