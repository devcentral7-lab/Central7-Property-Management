import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listStaffUsers } from "@/app/app/users/actions";
import { RegisterStaffForm } from "@/app/app/users/register-form";
import { StaffTable } from "@/app/app/users/staff-table";
import { listPartners } from "@/app/app/agents/actions";
import { RegisterPartnerForm } from "@/app/app/agents/register-form";
import { PartnersTable } from "@/app/app/agents/partners-table";
import { Icon, StatCard, type IconName } from "@/app/app/user-management/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
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

  const [staffResult, partnerResult] = await Promise.allSettled([
    listStaffUsers(),
    listPartners(),
  ]);
  const staffRows = staffResult.status === "fulfilled" ? staffResult.value : [];
  const staffError =
    staffResult.status === "rejected" ? errorMessage(staffResult.reason, "Could not load staff.") : null;
  const partnerRows = partnerResult.status === "fulfilled" ? partnerResult.value : [];
  const partnerError =
    partnerResult.status === "rejected"
      ? errorMessage(partnerResult.reason, "Could not load partners.")
      : null;

  const tabs = [
    {
      id: "users" as const,
      label: "Staff",
      icon: "users" as IconName,
      href: "/app/user-management",
      count: staffError ? null : staffRows.length,
    },
    {
      id: "partners" as const,
      label: "Partners",
      icon: "building" as IconName,
      href: "/app/user-management?tab=partners",
      count: partnerError ? null : partnerRows.length,
    },
  ];

  const stats: { label: string; value: number; hint?: string; icon: IconName; accent?: boolean }[] =
    tab === "users"
      ? [
          { label: "Total staff", value: staffRows.length, icon: "users", accent: true },
          {
            label: "Admins",
            value: staffRows.filter((u) => u.role === "Admin").length,
            hint: "Full access",
            icon: "shield",
          },
          {
            label: "Active",
            value: staffRows.filter((u) => u.active).length,
            hint: "Can sign in",
            icon: "check",
          },
          {
            label: "Inactive",
            value: staffRows.filter((u) => !u.active).length,
            hint: "Sign-in disabled",
            icon: "pause",
          },
        ]
      : [
          { label: "Total partners", value: partnerRows.length, icon: "building", accent: true },
          {
            label: "Approved",
            value: partnerRows.filter((p) => p.status === "Approved").length,
            icon: "check",
          },
          {
            label: "Pending approval",
            value: partnerRows.filter((p) => p.status === "Pending").length,
            hint: "Awaiting review",
            icon: "clock",
          },
          {
            label: "With login",
            value: partnerRows.filter((p) => p.auth_user_id).length,
            hint: "Portal access",
            icon: "key",
          },
        ];

  const listError = tab === "users" ? staffError : partnerError;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">User management</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage staff accounts and partner agencies, their roles and sign-in access.
          </p>
        </div>
        <div className="shrink-0">
          {tab === "users" ? <RegisterStaffForm /> : <RegisterPartnerForm />}
        </div>
      </header>

      <nav
        aria-label="User type"
        className="inline-flex rounded-full border border-[var(--line)] bg-[var(--card)] p-1 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
      >
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              {t.label}
              {t.count !== null ? (
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-[var(--bg-accent)] text-[var(--muted)]"
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {listError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">{listError}</p>
      ) : tab === "users" ? (
        <StaffTable rows={staffRows} currentAdminId={profile.id} />
      ) : (
        <PartnersTable rows={partnerRows} />
      )}
    </div>
  );
}
