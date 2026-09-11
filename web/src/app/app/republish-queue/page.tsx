import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function RepublishQueuePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("republish_queue")
    .select("*")
    .is("completed_at", null)
    .order("queued_at", { ascending: false })
    .limit(50);

  if (profile.role !== "Admin") {
    query = query.eq("user_name", profile.display_name);
  }

  const { data, error } = await query;
  if (error) return <p className="text-[var(--danger)]">{error.message}</p>;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Republish queue</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pending items only. Excel replace / clear can be added after Auth cutover.
      </p>
      <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {(data ?? []).map((row) => (
          <li key={row.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link
                href={`/app/properties/${row.ref_no}`}
                className="font-semibold text-[var(--brand-deep)] hover:underline"
              >
                {row.ref_no}
              </Link>
              <p className="text-sm text-[var(--muted)]">{row.user_name || "—"}</p>
            </div>
            <span className="text-sm text-[var(--muted)]">{row.action || "Pending"}</span>
          </li>
        ))}
        {!data?.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">No pending items.</li>
        ) : null}
      </ul>
    </div>
  );
}
