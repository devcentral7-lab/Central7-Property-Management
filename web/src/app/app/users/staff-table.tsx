"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteStaffUser,
  resetStaffPassword,
  updateStaffUser,
} from "@/app/app/users/actions";
import type { StaffListItem } from "@/app/app/users/actions";
import { ClickableRow } from "@/components/clickable-row";
import { PopupDialog } from "@/components/popup-dialog";
import { StatusBadge } from "@/components/status-badge";
import {
  ConfirmDialog,
  CredentialsDialog,
  type ConfirmRequest,
  type Credentials,
} from "@/app/app/user-management/dialogs";
import {
  Avatar,
  FilterChip,
  Icon,
  Pill,
  SearchBox,
  Toggle,
  dangerIconButtonClass,
  fieldClass,
  formatJoined,
  iconButtonClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/app/user-management/ui";

type Props = {
  rows: StaffListItem[];
  currentAdminId: string;
};

type Filter = "all" | "Admin" | "User" | "inactive";

export function StaffTable({ rows, currentAdminId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<StaffListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      Admin: rows.filter((u) => u.role === "Admin").length,
      User: rows.filter((u) => u.role === "User").length,
      inactive: rows.filter((u) => !u.active).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (filter === "inactive" && u.active) return false;
      if ((filter === "Admin" || filter === "User") && u.role !== filter) return false;
      if (!q) return true;
      return [u.display_name, u.email, u.mobile_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

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

  function openEdit(u: StaffListItem) {
    if (pending) return;
    setError(null);
    setEditing(u);
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
      setEditing(null);
    });
  }

  function onReset(u: StaffListItem) {
    setConfirmReq({
      title: "Reset password?",
      body: `${u.display_name} will need the new 10-digit temporary password to sign in. It is shown only once.`,
      confirmLabel: "Reset password",
      onConfirm: () =>
        run(async () => {
          const res = await resetStaffPassword(u.id);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setCreds({
            title: "Password reset",
            subtitle: u.display_name,
            details: [["Email", res.email]],
            email: res.email,
            password: res.tempPassword,
          });
        }),
    });
  }

  function onDelete(u: StaffListItem) {
    setConfirmReq({
      title: `Delete ${u.display_name}?`,
      body: "This removes their login permanently and cannot be undone.",
      confirmLabel: "Delete user",
      danger: true,
      onConfirm: () =>
        run(async () => {
          const res = await deleteStaffUser(u.id);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          if (editing?.id === u.id) setEditing(null);
        }),
    });
  }

  function actions(u: StaffListItem) {
    const isSelf = u.id === currentAdminId;
    return (
      <div className="flex items-center justify-end gap-0.5" data-row-ignore>
        <button type="button" disabled={pending} onClick={() => openEdit(u)} title="Edit" aria-label={`Edit ${u.display_name}`} className={iconButtonClass}>
          <Icon name="edit" className="h-4 w-4" />
        </button>
        <button type="button" disabled={pending} onClick={() => onReset(u)} title="Reset password" aria-label={`Reset password for ${u.display_name}`} className={iconButtonClass}>
          <Icon name="key" className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pending || isSelf}
          onClick={() => onDelete(u)}
          title={isSelf ? "You cannot delete your own account" : "Delete user"}
          aria-label={`Delete ${u.display_name}`}
          className={dangerIconButtonClass}
        >
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function identity(u: StaffListItem) {
    const isSelf = u.id === currentAdminId;
    return (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={u.display_name} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{u.display_name}</span>
            {isSelf ? <Pill>You</Pill> : null}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">{u.email || "No email"}</p>
        </div>
      </div>
    );
  }

  const rolePill = (role: StaffListItem["role"]) =>
    role === "Admin" ? (
      <Pill tone="brand">
        <Icon name="shield" className="h-3.5 w-3.5" />
        Admin
      </Pill>
    ) : (
      <Pill>User</Pill>
    );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Staff directory</h2>
            <p className="text-xs text-[var(--muted)]">
              Everyone who can sign in to Central7 Pulse as staff.
            </p>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, email or phone" />
        </div>

        <div className="tab-scroll flex gap-2 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>All</FilterChip>
          <FilterChip active={filter === "Admin"} count={counts.Admin} onClick={() => setFilter("Admin")}>Admins</FilterChip>
          <FilterChip active={filter === "User"} count={counts.User} onClick={() => setFilter("User")}>Users</FilterChip>
          <FilterChip active={filter === "inactive"} count={counts.inactive} onClick={() => setFilter("inactive")}>Inactive</FilterChip>
        </div>

        {error && !editing ? (
          <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:mx-5">{error}</p>
        ) : null}

        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-[var(--bg)]/60 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Member</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Added</th>
              <th className="px-5 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <ClickableRow
                key={u.id}
                className="border-t border-[var(--line)]"
                onActivate={() => openEdit(u)}
              >
                <td className="max-w-[20rem] px-5 py-3">{identity(u)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {u.mobile_number || <span className="text-[var(--muted)]">—</span>}
                </td>
                <td className="px-4 py-3">{rolePill(u.role)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.active ? "Active" : "Inactive"} className={u.active ? "" : "text-[var(--muted)]"} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">{formatJoined(u.created_at)}</td>
                <td className="px-5 py-2">{actions(u)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-[var(--line)] md:hidden">
          {visible.map((u) => (
            <ClickableRow key={u.id} as="li" className="px-4 py-3" onActivate={() => openEdit(u)}>
              <div className="flex items-start justify-between gap-3">
                {identity(u)}
                {rolePill(u.role)}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 pl-12">
                <div className="min-w-0 text-xs">
                  <StatusBadge status={u.active ? "Active" : "Inactive"} className={u.active ? "" : "text-[var(--muted)]"} />
                  {u.mobile_number ? (
                    <span className="ml-3 text-[var(--muted)]">{u.mobile_number}</span>
                  ) : null}
                </div>
                {actions(u)}
              </div>
            </ClickableRow>
          ))}
        </ul>

        {!visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
              <Icon name="users" />
            </span>
            <p className="text-sm font-semibold">{rows.length ? "No matching staff" : "No staff users yet"}</p>
            <p className="text-xs text-[var(--muted)]">
              {rows.length ? "Try a different search or filter." : "Add your first staff user to get started."}
            </p>
          </div>
        ) : null}
      </section>

      <PopupDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.display_name}` : ""}
        subtitle={editing ? `Added ${formatJoined(editing.created_at)}` : undefined}
        busy={pending}
        size="lg"
      >
        {editing ? (
          <form key={editing.id} onSubmit={(e) => onSave(e, editing.id)} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
            <label className={labelClass}>
              Display name
              <input name="display_name" required defaultValue={editing.display_name} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Email
              <input name="email" type="email" required defaultValue={editing.email ?? ""} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input name="mobile_number" type="tel" defaultValue={editing.mobile_number ?? ""} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Role
              <select name="role" defaultValue={editing.role} className={fieldClass}>
                <option value="User">User</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <Toggle name="active" defaultChecked={editing.active} label="Active" description="Inactive users can’t sign in." />
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">{error}</p>
            ) : null}

            <div className="flex gap-2 sm:col-span-2 sm:justify-end">
              <button type="button" onClick={() => setEditing(null)} disabled={pending} className={`flex-1 sm:flex-none ${secondaryButtonClass}`}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : null}
      </PopupDialog>

      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
    </>
  );
}
