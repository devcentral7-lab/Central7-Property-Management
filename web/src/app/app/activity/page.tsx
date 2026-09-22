import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ActivityPage() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const supabase = await createClient();

  const query = supabase
    .from("property_status_events")
    .select(
      "id, occurred_at, ref_no, actor_name, action, comment, assigned_to, requested_platforms, boost_completed",
    )
    .is("archived_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50)
    .or(`assigned_to.is.null,assigned_to.eq.${profile.display_name}`);

  const { data, error } = await query;
  if (error) {
    return <p className="text-[var(--danger)]">{error.message}</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Activity log</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Latest 50 open events assigned to you or unassigned. Never loads the full properties table.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/50 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((e) => (
              <tr key={e.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/app/properties/${e.ref_no}`}
                    className="font-semibold text-[var(--brand-deep)] hover:underline"
                  >
                    {e.ref_no}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {e.action}
                  {e.comment ? (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{e.comment}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{e.actor_name || "—"}</td>
                <td className="px-4 py-3">{e.assigned_to || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
