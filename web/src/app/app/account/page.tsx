import { requireProfile } from "@/lib/auth";
import { ChangePasswordForm } from "@/app/app/account/change-password-form";

export default async function AccountPage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {profile.display_name} · {profile.role}
          {profile.mobile_number ? ` · ${profile.mobile_number}` : ""}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
