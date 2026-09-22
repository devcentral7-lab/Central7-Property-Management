import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listStaffUsers } from "@/app/app/users/actions";
import { RegisterStaffForm } from "@/app/app/users/register-form";
import { StaffTable } from "@/app/app/users/staff-table";

export default async function UsersPage() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  let rows: Awaited<ReturnType<typeof listStaffUsers>> = [];
  let listError: string | null = null;
  try {
    rows = await listStaffUsers();
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load staff.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">User management</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Staff (`profiles`) — name, email, phone, role, active. Partners
          live under Partners (`users` table).
        </p>
      </div>

      <RegisterStaffForm />

      <div>
        <h2 className="mb-3 font-display text-xl font-semibold">Staff directory</h2>
        {listError ? (
          <p className="text-sm text-[var(--danger)]">{listError}</p>
        ) : (
          <StaffTable rows={rows} currentAdminId={profile.id} />
        )}
      </div>
    </div>
  );
}
