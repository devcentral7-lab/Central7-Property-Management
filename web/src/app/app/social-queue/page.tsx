import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SocialQueuePage() {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_media_queue")
    .select("*")
    .is("completed_at", null)
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) return <p className="text-[var(--danger)]">{error.message}</p>;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Social media queue</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Incomplete items only (max 50). Platform date marking can be wired next.
      </p>
      <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {(data ?? []).map((row) => (
          <li key={row.id} className="px-4 py-3">
            <Link
              href={`/app/properties/${row.ref_no}`}
              className="font-semibold text-[var(--brand-deep)] hover:underline"
            >
              {row.ref_no}
            </Link>
            <p className="text-sm text-[var(--muted)]">
              {row.approved_action || "—"} · by {row.approved_by || "—"}
            </p>
          </li>
        ))}
        {!data?.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">Queue empty.</li>
        ) : null}
      </ul>
    </div>
  );
}
