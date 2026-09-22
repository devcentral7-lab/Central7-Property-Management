"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPartnerLogin,
  deletePartner,
  resetPartnerPassword,
  updatePartner,
  type PartnerListItem,
} from "@/app/app/agents/actions";

const fieldClass =
  "mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm";

export function PartnersTable({ rows }: { rows: PartnerListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cred, setCred] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function onSave(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("partner_id", id);
    run(async () => {
      const res = await updatePartner(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingId(null);
    });
  }

  function onReset(id: string) {
    if (!confirm("Reset this partner’s password? A new 10-digit password will be shown once.")) {
      return;
    }
    run(async () => {
      const res = await resetPartnerPassword(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCred({ email: res.email, tempPassword: res.tempPassword });
    });
  }

  function onCreateLogin(id: string) {
    run(async () => {
      const res = await createPartnerLogin(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCred({ email: res.email, tempPassword: res.tempPassword });
    });
  }

  function onDelete(id: string, label: string) {
    if (!confirm(`Delete partner ${label}? This cannot be undone.`)) return;
    run(async () => {
      const res = await deletePartner(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (editingId === id) setEditingId(null);
    });
  }

  async function copyCred() {
    if (!cred) return;
    await navigator.clipboard.writeText(
      `Email: ${cred.email}\nTemporary password: ${cred.tempPassword}`,
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

      {cred ? (
        <div className="rounded-2xl border border-[var(--brand)] bg-[var(--bg-accent)] p-5">
          <h3 className="font-display text-lg font-semibold text-[var(--brand-deep)]">
            Login credentials — copy now
          </h3>
          <p className="mt-2 text-sm">Email: {cred.email}</p>
          <p className="mt-1 font-mono text-base font-semibold tracking-wider">
            {cred.tempPassword}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copyCred}
              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setCred(null)}
              className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/50 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
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
                        {(
                          [
                            ["Company", "company_name", u.company_name],
                            ["Contact person", "contact_person", u.contact_person],
                            ["Contact number", "contact_number", u.contact_number],
                            ["Email", "email", u.email],
                            ["Username", "username", u.username],
                          ] as const
                        ).map(([label, name, value]) => (
                          <label key={name} className="text-sm font-medium">
                            {label}
                            <input
                              name={name}
                              required={name === "username"}
                              type={name === "email" ? "email" : "text"}
                              defaultValue={value ?? ""}
                              suppressHydrationWarning
                              className={fieldClass}
                            />
                          </label>
                        ))}
                        <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">
                          Address
                          <textarea
                            name="address"
                            rows={2}
                            defaultValue={u.address ?? ""}
                            suppressHydrationWarning
                            className={fieldClass}
                          />
                        </label>
                        <label className="text-sm font-medium">
                          Status
                          <select
                            name="status"
                            defaultValue={u.status}
                            suppressHydrationWarning
                            className={fieldClass}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
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
                        <div className="flex flex-wrap items-end gap-2">
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
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
                      <td className="px-4 py-3">{u.company_name || "—"}</td>
                      <td className="px-4 py-3">
                        {u.contact_person || "—"}
                        <span className="block text-xs text-[var(--muted)]">
                          {[u.contact_number, u.email].filter(Boolean).join(" · ")}
                        </span>
                        {u.address ? (
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            {u.address}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{u.username}</td>
                      <td className="px-4 py-3">
                        {u.status}
                        <span className="block text-xs text-[var(--muted)]">
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {u.auth_user_id ? "Linked" : "No login"}
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
                          {u.auth_user_id ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onReset(u.id)}
                              className="text-sm font-medium text-[var(--muted)] hover:underline"
                            >
                              Reset password
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onCreateLogin(u.id)}
                              className="text-sm font-medium text-[var(--muted)] hover:underline"
                            >
                              Create login
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              onDelete(u.id, u.company_name || u.username)
                            }
                            className="text-sm font-medium text-[var(--danger)] hover:underline"
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
                  No partners yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
