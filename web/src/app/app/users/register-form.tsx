"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerStaffUser } from "@/app/app/users/actions";

export function RegisterStaffForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    display_name: string;
    tempPassword: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerStaffUser(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({
        email: result.email,
        display_name: result.display_name,
        tempPassword: result.tempPassword,
        role: result.role,
      });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  async function copyCreds() {
    if (!created) return;
    const text = `Email: ${created.email}\nTemporary password: ${created.tempPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 sm:grid-cols-2"
        suppressHydrationWarning
      >
        <h2 className="font-display text-lg font-semibold sm:col-span-2">
          Register staff user
        </h2>
        <label className="text-sm font-medium" suppressHydrationWarning>
          Display name *
          <input
            name="display_name"
            required
            autoComplete="off"
            suppressHydrationWarning
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            placeholder="Chaminda"
          />
        </label>
        <label className="text-sm font-medium" suppressHydrationWarning>
          Email *
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            suppressHydrationWarning
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            placeholder="name@central7.lk"
          />
        </label>
        <label className="text-sm font-medium" suppressHydrationWarning>
          Phone
          <input
            name="mobile_number"
            autoComplete="off"
            suppressHydrationWarning
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            placeholder="077…"
          />
        </label>
        <label className="text-sm font-medium" suppressHydrationWarning>
          Role *
          <select
            name="role"
            defaultValue="User"
            suppressHydrationWarning
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          >
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium" suppressHydrationWarning>
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked
            suppressHydrationWarning
          />
          Active
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            suppressHydrationWarning
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
          >
            {pending ? "Registering…" : "Register"}
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">
            {error}
          </p>
        ) : null}
      </form>

      {created ? (
        <div className="rounded-2xl border border-[var(--brand)] bg-[var(--bg-accent)] p-5">
          <h3 className="font-display text-lg font-semibold text-[var(--brand-deep)]">
            Account created — copy password now
          </h3>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Name</dt>
              <dd className="font-medium">{created.display_name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Role</dt>
              <dd className="font-medium">{created.role}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Email</dt>
              <dd className="font-medium">{created.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Temporary password
              </dt>
              <dd className="font-mono text-base font-semibold tracking-wider">
                {created.tempPassword}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={copyCreds}
            className="mt-4 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
          >
            {copied ? "Copied" : "Copy email + password"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
