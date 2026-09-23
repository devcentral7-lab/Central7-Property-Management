import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listStaffUsers } from "@/app/app/users/actions";
import { RegisterStaffForm } from "@/app/app/users/register-form";
import { StaffTable } from "@/app/app/users/staff-table";
import { listPartners } from "@/app/app/agents/actions";
import { RegisterPartnerForm } from "@/app/app/agents/register-form";
import { PartnersTable } from "@/app/app/agents/partners-table";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function UserManagementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const sp = await searchParams;
  const tab = one(sp.tab).toLowerCase() === "partners" ? "partners" : "users";

  const tabs = [
    { id: "users" as const, label: "Users", href: "/app/user-management" },
    {
      id: "partners" as const,
      label: "Partners",
      href: "/app/user-management?tab=partners",
    },
  ];

  let staffRows: Awaited<ReturnType<typeof listStaffUsers>> = [];
  let staffError: string | null = null;
  let partnerRows: Awaited<ReturnType<typeof listPartners>> = [];
  let partnerError: string | null = null;

  if (tab === "users") {
    try {
      staffRows = await listStaffUsers();
    } catch (e) {
      staffError = e instanceof Error ? e.message : "Could not load staff.";
    }
  } else {
    try {
      partnerRows = await listPartners();
    } catch (e) {
      partnerError =
        e instanceof Error ? e.message : "Could not load partners.";
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">User management</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {tab === "users"
            ? "Staff accounts — name, email, phone, role, and active status."
            : "Partner onboarding — company, contact, address, approval, and optional login."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "users" ? (
        <>
          <RegisterStaffForm />
          <div>
            <h2 className="mb-3 font-display text-xl font-semibold">
              Staff directory
            </h2>
            {staffError ? (
              <p className="text-sm text-[var(--danger)]">{staffError}</p>
            ) : (
              <StaffTable rows={staffRows} currentAdminId={profile.id} />
            )}
          </div>
        </>
      ) : (
        <>
          <RegisterPartnerForm />
          <div>
            <h2 className="mb-3 font-display text-xl font-semibold">
              Partner directory
            </h2>
            {partnerError ? (
              <p className="text-sm text-[var(--danger)]">{partnerError}</p>
            ) : (
              <PartnersTable rows={partnerRows} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
