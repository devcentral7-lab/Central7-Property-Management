"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerPartner } from "@/app/app/agents/actions";

const fieldClass =
  "mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm";

export function RegisterPartnerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    username: string;
    email: string | null;
    tempPassword: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerPartner(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({
        username: result.username,
        email: result.email,
        tempPassword: result.tempPassword,
      });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  async function copyCreds() {
    if (!created?.tempPassword || !created.email) return;
    await navigator.clipboard.writeText(
      `Email: ${created.email}\nTemporary password: ${created.tempPassword}`,
    );
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
          Register partner
        </h2>
        {(
          [
            ["Company name", "company_name", false],
            ["Contact person", "contact_person", false],
            ["Contact number", "contact_number", false],
            ["Email", "email", false],
            ["Username *", "username", true],
          ] as const
        ).map(([label, name, required]) => (
          <label key={name} className="text-sm font-medium" suppressHydrationWarning>
            {label}
            <input
              name={name}
              required={required}
              type={name === "email" ? "email" : "text"}
              autoComplete="off"
              suppressHydrationWarning
              className={fieldClass}
            />
          </label>
        ))}
        <label className="text-sm font-medium sm:col-span-2" suppressHydrationWarning>
          Address
          <textarea name="address" rows={2} suppressHydrationWarning className={fieldClass} />
        </label>
        <label className="text-sm font-medium" suppressHydrationWarning>
          Status
          <select name="status" defaultValue="Approved" suppressHydrationWarning className={fieldClass}>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium" suppressHydrationWarning>
          <input type="checkbox" name="active" value="true" defaultChecked suppressHydrationWarning />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2" suppressHydrationWarning>
          <input type="checkbox" name="create_login" value="true" defaultChecked suppressHydrationWarning />
          Create login (email + 10-digit temp password). Skip profile row in staff
          tables — partners use the Agent role.
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            suppressHydrationWarning
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
          >
            {pending ? "Registering…" : "Register partner"}
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
            Partner registered
          </h3>
          <p className="mt-2 text-sm">Username: {created.username}</p>
          {created.tempPassword && created.email ? (
            <>
              <p className="mt-2 text-sm">Email: {created.email}</p>
              <p className="mt-1 font-mono text-base font-semibold tracking-wider">
                {created.tempPassword}
              </p>
              <button
                type="button"
                onClick={copyCreds}
                className="mt-3 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
              >
                {copied ? "Copied" : "Copy email + password"}
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">
              No login created.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
