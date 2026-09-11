import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AgentsPage() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, company_name, contact_person, contact_number, email, username, status, active, nic, passport_number, address, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return <p className="text-[var(--danger)]">{error.message}</p>;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Partner users</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Legacy Agents table → `users`. Approve / Auth linking comes with Auth setup.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/50 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3">{u.company_name || "—"}</td>
                <td className="px-4 py-3">
                  {u.contact_person || "—"}
                  <span className="block text-xs text-[var(--muted)]">
                    {u.contact_number || u.email || ""}
                  </span>
                </td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3">{u.status}</td>
                <td className="px-4 py-3">{u.active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!data?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No partner users loaded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
