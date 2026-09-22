import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listPartners } from "@/app/app/agents/actions";
import { RegisterPartnerForm } from "@/app/app/agents/register-form";
import { PartnersTable } from "@/app/app/agents/partners-table";

export default async function AgentsPage() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  let rows: Awaited<ReturnType<typeof listPartners>> = [];
  let listError: string | null = null;
  try {
    rows = await listPartners();
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load partners.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Partners</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Full partner onboarding — company, contact, address, approval
          status, and optional login.
        </p>
      </div>

      <RegisterPartnerForm />

      <div>
        <h2 className="mb-3 font-display text-xl font-semibold">Partner directory</h2>
        {listError ? (
          <p className="text-sm text-[var(--danger)]">{listError}</p>
        ) : (
          <PartnersTable rows={rows} />
        )}
      </div>
    </div>
  );
}
