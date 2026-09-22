"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteStaffUser,
  resetStaffPassword,
  updateStaffUser,
} from "@/app/app/users/actions";
import type { StaffListItem } from "@/app/app/users/actions";

type Props = {
  rows: StaffListItem[];
  currentAdminId: string;
};

export function StaffTable({ rows, currentAdminId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetCred, setResetCred] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function onSave(e: React.FormEvent<HTMLFormElement>, userId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("user_id", userId);
    run(async () => {
      const res = await updateStaffUser(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingId(null);
    });
  }

  function onReset(userId: string) {
    if (
      !confirm(
        "Reset this user’s password? A new 10-digit password will be shown once.",
      )
    ) {
      return;
    }
    run(async () => {
      const res = await resetStaffPassword(userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResetCred({ email: res.email, tempPassword: res.tempPassword });
    });
  }

  function onDelete(userId: string, name: string) {
    if (
      !confirm(
        `Delete ${name}? This removes their login permanently and cannot be undone.`,
      )
    ) {
      return;
    }
    run(async () => {
      const res = await deleteStaffUser(userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (editingId === userId) setEditingId(null);
    });
  }

  async function copyReset() {
    if (!resetCred) return;
    await navigator.clipboard.writeText(
      `Email: ${resetCred.email}\nTemporary password: ${resetCred.tempPassword}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {resetCred ? (
        <div className="rounded-2xl border border-[var(--brand)] bg-[var(--bg-accent)] p-5">
          <h3 className="font-display text-lg font-semibold text-[var(--brand-deep)]">
            Password reset — copy now
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Shown once. Share securely with the user.
          </p>
          <p className="mt-3 text-sm">
            <span className="text-[var(--muted)]">Email:</span> {resetCred.email}
          </p>
          <p className="mt-1 font-mono text-base font-semibold tracking-wider">
            {resetCred.tempPassword}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copyReset}
              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setResetCred(null)}
              className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/50 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.id === currentAdminId;
              const isEditing = editingId === u.id;
              return (
                <tr key={u.id} className="border-b border-[var(--line)] last:border-0 align-top">
                  {isEditing ? (
                    <td colSpan={6} className="px-4 py-4">
                      <form
                        onSubmit={(e) => onSave(e, u.id)}
                        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                        suppressHydrationWarning
                      >
                        <label className="text-sm font-medium">
                          Name
                          <input
                            name="display_name"
                            required
                            defaultValue={u.display_name}
                            suppressHydrationWarning
                            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm font-medium">
                          Email
                          <input
                            name="email"
                            type="email"
                            required
                            defaultValue={u.email ?? ""}
                            suppressHydrationWarning
                            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm font-medium">
                          Phone
                          <input
                            name="mobile_number"
                            defaultValue={u.mobile_number ?? ""}
                            suppressHydrationWarning
                            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-sm font-medium">
                          Role
                          <select
                            name="role"
                            defaultValue={u.role}
                            suppressHydrationWarning
                            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                          >
                            <option value="User">User</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </label>
                        <label className="mt-6 flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            name="active"
                            value="true"
                            defaultChecked={u.active}
                            suppressHydrationWarning
                          />
                          Active
                        </label>
                        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">{u.display_name}</td>
                      <td className="px-4 py-3">{u.email || "—"}</td>
                      <td className="px-4 py-3">{u.mobile_number || "—"}</td>
                      <td className="px-4 py-3">{u.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            u.active
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-stone-100 text-[var(--muted)]"
                          }`}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setError(null);
                              setEditingId(u.id);
                            }}
                            className="text-sm font-medium text-[var(--brand-deep)] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onReset(u.id)}
                            className="text-sm font-medium text-[var(--muted)] hover:underline"
                          >
                            Reset password
                          </button>
                          <button
                            type="button"
                            disabled={pending || isSelf}
                            title={
                              isSelf
                                ? "You cannot delete your own account"
                                : "Delete user"
                            }
                            onClick={() => onDelete(u.id, u.display_name)}
                            className="text-sm font-medium text-[var(--danger)] hover:underline disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No staff users yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
