"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/app/users/actions";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await changePassword(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
      suppressHydrationWarning
    >
      <h2 className="font-display text-lg font-semibold">Change password</h2>
      <label className="block text-sm font-medium" suppressHydrationWarning>
        Current password
        <input
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          suppressHydrationWarning
          className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium" suppressHydrationWarning>
        New password
        <input
          name="new_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          suppressHydrationWarning
          className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium" suppressHydrationWarning>
        Confirm new password
        <input
          name="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          suppressHydrationWarning
          className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Password updated.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
