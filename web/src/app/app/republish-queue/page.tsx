import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PropertyLink } from "@/app/app/properties/property-modal";

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
      <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {(data ?? []).map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <PropertyLink refNo={row.ref_no}>{row.ref_no}</PropertyLink>
              <p className="text-sm text-[var(--muted)]">
                {row.user_name || "—"}
              </p>
            </div>
            <span className="text-sm text-[var(--muted)]">
              {row.action || "Pending"}
            </span>
          </li>
        ))}
        {!data?.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No pending items.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
