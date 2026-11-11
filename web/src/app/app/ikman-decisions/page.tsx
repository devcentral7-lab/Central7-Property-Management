import { redirect } from "next/navigation";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { OwnerDecideButtons } from "@/app/app/ikman-republish/item-actions";
import { listIkmanItems } from "@/app/app/ikman-republish/actions";
import { requireProfile } from "@/lib/auth";

export default async function IkmanDecisionsPage() {
  const profile = await requireProfile();
  if (profile.role === "Social Media Manager") redirect("/app");
  // Admins use the merged Ikman Republish page (Owner pending tab).
  if (profile.role === "Admin") redirect("/app/ikman-republish?tab=pending");

  const rows = await listIkmanItems("pending_owner", { ownerOnly: true });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Ikman Decisions</h1>

      {rows.length ? (
        <ul className="mt-5 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <PropertyLink refNo={row.ref_no}>{row.ref_no}</PropertyLink>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {[row.property_type, row.opportunity_type, row.city].filter(Boolean).join(" · ") ||
                      "Listing"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Requested {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="w-full max-w-sm sm:w-auto">
                  <OwnerDecideButtons id={row.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          No Ikman republish decisions waiting for you.
        </p>
      )}
    </div>
  );
}
