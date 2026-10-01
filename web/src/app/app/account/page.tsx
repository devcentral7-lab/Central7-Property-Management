import type { ReactNode } from "react";
import { signOut } from "@/app/app/actions";
import { ChangePasswordForm } from "@/app/app/account/change-password-form";
import { Avatar, Icon, Pill, type IconName } from "@/app/app/user-management/ui";
import { PhoneWithWhatsApp } from "@/components/whatsapp-link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

function fmt(value: string | null | undefined, withTime = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (withTime ? DATE_TIME : DATE).format(d);
}

function DetailRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)] text-[var(--muted)]">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <div className="truncate text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export default async function AccountPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const memberSince = fmt(user?.created_at);
  const lastSignIn = fmt(user?.last_sign_in_at, true);
  const isAdmin = profile.role === "Admin";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your profile details and sign-in security.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="h-fit overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
          <div className="relative h-24 overflow-hidden bg-[var(--sidebar)]">
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-[var(--brand)]" />
            <span
              aria-hidden
              className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[var(--brand)]/25 blur-2xl"
            />
          </div>
          <div className="px-5 pb-5">
            <div className="relative -mt-10 flex items-end justify-between gap-3">
              <Avatar
                name={profile.display_name}
                size="lg"
                className="ring-4 ring-[var(--card)]"
              />
              <Pill tone={isAdmin ? "brand" : "neutral"}>
                {isAdmin ? <Icon name="shield" className="h-3.5 w-3.5" /> : null}
                {profile.role}
              </Pill>
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold">{profile.display_name}</h2>
            <p className="text-sm text-[var(--muted)]">
              {isAdmin ? "Administrator · full access" : "Staff member"}
            </p>

            <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              <DetailRow icon="mail" label="Email">
                {user?.email ?? <span className="text-[var(--muted)]">—</span>}
              </DetailRow>
              <DetailRow icon="phone" label="Mobile">
                {profile.mobile_number ? (
                  <PhoneWithWhatsApp phone={profile.mobile_number} />
                ) : (
                  <span className="text-[var(--muted)]">Not set</span>
                )}
              </DetailRow>
              {memberSince ? (
                <DetailRow icon="calendar" label="Member since">
                  {memberSince}
                </DetailRow>
              ) : null}
              {lastSignIn ? (
                <DetailRow icon="clock" label="Last sign-in">
                  {lastSignIn}
                </DetailRow>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-[var(--muted)]">
              To change your name, email or role, ask an administrator.
            </p>

            <form action={signOut} className="mt-4">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-semibold transition hover:border-red-200 hover:bg-red-50 hover:text-[var(--danger)]"
              >
                <Icon name="logout" className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
          <div className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
              <Icon name="key" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">Change Password</h2>
              <p className="text-sm text-[var(--muted)]">
                Confirm your current password, then choose a new one.
              </p>
            </div>
          </div>
          <div className="p-5">
            <ChangePasswordForm />
          </div>
        </section>
      </div>
    </div>
  );
}
