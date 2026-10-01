"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createPartnerLogin,
  deletePartner,
  resetPartnerPassword,
  updatePartner,
  type PartnerListItem,
} from "@/app/app/agents/actions";
import { PartnerFields } from "@/app/app/agents/register-form";
import { ClickableRow } from "@/components/clickable-row";
import { PopupDialog } from "@/components/popup-dialog";
import { StatusBadge } from "@/components/status-badge";
import { PhoneWithWhatsApp } from "@/components/whatsapp-link";
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
  formatJoined,
  iconButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/app/user-management/ui";

type Filter = "all" | PartnerListItem["status"] | "nologin";

const APPROVAL_TONE = {
  Approved: "green",
  Pending: "amber",
  Rejected: "red",
} as const;

function partnerName(u: PartnerListItem) {
  return u.company_name || u.contact_person || u.username;
}

export function PartnersTable({ rows }: { rows: PartnerListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<PartnerListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      Approved: rows.filter((u) => u.status === "Approved").length,
      Pending: rows.filter((u) => u.status === "Pending").length,
      Rejected: rows.filter((u) => u.status === "Rejected").length,
      nologin: rows.filter((u) => !u.auth_user_id).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (filter === "nologin" && u.auth_user_id) return false;
      if ((filter === "Approved" || filter === "Pending" || filter === "Rejected") && u.status !== filter) {
        return false;
      }
      if (!q) return true;
      return [u.company_name, u.contact_person, u.contact_number, u.email, u.username, u.address]
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

  function openEdit(u: PartnerListItem) {
    if (pending) return;
    setError(null);
    setEditing(u);
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
      setEditing(null);
    });
  }

  function showCreds(u: PartnerListItem, title: string, res: { email: string; tempPassword: string }) {
    setCreds({
      title,
      subtitle: partnerName(u),
      details: [
        ["Username", u.username],
        ["Email", res.email],
      ],
      email: res.email,
      password: res.tempPassword,
    });
  }

  function onReset(u: PartnerListItem) {
    setConfirmReq({
      title: "Reset Password?",
      body: `${partnerName(u)} will need the new 10-digit temporary password to sign in. It is shown only once.`,
      confirmLabel: "Reset password",
      onConfirm: () =>
        run(async () => {
          const res = await resetPartnerPassword(u.id);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          showCreds(u, "Password reset", res);
        }),
    });
  }

  function onCreateLogin(u: PartnerListItem) {
    run(async () => {
      const res = await createPartnerLogin(u.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      showCreds(u, "Login created", res);
    });
  }

  function onDelete(u: PartnerListItem) {
    setConfirmReq({
      title: `Delete ${partnerName(u)}?`,
      body: "This removes the partner and their login. It cannot be undone.",
      confirmLabel: "Delete partner",
      danger: true,
      onConfirm: () =>
        run(async () => {
          const res = await deletePartner(u.id);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          if (editing?.id === u.id) setEditing(null);
        }),
    });
  }

  function actions(u: PartnerListItem) {
    const name = partnerName(u);
    return (
      <div className="flex items-center justify-end gap-0.5" data-row-ignore>
        <button type="button" disabled={pending} onClick={() => openEdit(u)} title="Edit" aria-label={`Edit ${name}`} className={iconButtonClass}>
          <Icon name="edit" className="h-4 w-4" />
        </button>
        {u.auth_user_id ? (
          <button type="button" disabled={pending} onClick={() => onReset(u)} title="Reset password" aria-label={`Reset password for ${name}`} className={iconButtonClass}>
            <Icon name="key" className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => onCreateLogin(u)} title="Create login" aria-label={`Create login for ${name}`} className={iconButtonClass}>
            <Icon name="userPlus" className="h-4 w-4" />
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => onDelete(u)} title="Delete partner" aria-label={`Delete ${name}`} className={dangerIconButtonClass}>
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function identity(u: PartnerListItem) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={partnerName(u)} square />
        <div className="min-w-0">
          <p className="truncate font-semibold">{partnerName(u)}</p>
          <p className="truncate font-mono text-xs text-[var(--muted)]">@{u.username}</p>
        </div>
      </div>
    );
  }

  function contact(u: PartnerListItem) {
    return (
      <div className="min-w-0">
        <p className="truncate">{u.contact_person || <span className="text-[var(--muted)]">—</span>}</p>
        {u.contact_number || u.email ? (
          <p className="flex min-w-0 items-center gap-1 text-xs text-[var(--muted)]">
            {u.contact_number ? <PhoneWithWhatsApp phone={u.contact_number} className="shrink-0" /> : null}
            {u.contact_number && u.email ? <span aria-hidden>·</span> : null}
            {u.email ? <span className="min-w-0 truncate">{u.email}</span> : null}
          </p>
        ) : null}
      </div>
    );
  }

  const loginPill = (u: PartnerListItem) =>
    u.auth_user_id ? (
      <Pill tone="green">
        <Icon name="link" className="h-3.5 w-3.5" />
        Linked
      </Pill>
    ) : (
      <Pill>No login</Pill>
    );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Partner Directory</h2>
            <p className="text-xs text-[var(--muted)]">Agencies and brokers who list through Central7.</p>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search company, contact or username" />
        </div>

        <div className="tab-scroll flex gap-2 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>All</FilterChip>
          <FilterChip active={filter === "Approved"} count={counts.Approved} onClick={() => setFilter("Approved")}>Approved</FilterChip>
          <FilterChip active={filter === "Pending"} count={counts.Pending} onClick={() => setFilter("Pending")}>Pending</FilterChip>
          <FilterChip active={filter === "Rejected"} count={counts.Rejected} onClick={() => setFilter("Rejected")}>Rejected</FilterChip>
          <FilterChip active={filter === "nologin"} count={counts.nologin} onClick={() => setFilter("nologin")}>No login</FilterChip>
        </div>

        {error && !editing ? (
          <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:mx-5">{error}</p>
        ) : null}

        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-[var(--bg)]/60 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Partner</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Approval</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Login</th>
              <th className="px-5 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <ClickableRow key={u.id} className="border-t border-[var(--line)]" onActivate={() => openEdit(u)}>
                <td className="max-w-[16rem] px-5 py-3">{identity(u)}</td>
                <td className="max-w-[18rem] px-4 py-3">{contact(u)}</td>
                <td className="px-4 py-3">
                  <Pill tone={APPROVAL_TONE[u.status]}>{u.status}</Pill>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.active ? "Active" : "Inactive"} className={u.active ? "" : "text-[var(--muted)]"} />
                </td>
                <td className="px-4 py-3">{loginPill(u)}</td>
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
                <Pill tone={APPROVAL_TONE[u.status]}>{u.status}</Pill>
              </div>
              <div className="mt-2 pl-12 text-sm">{contact(u)}</div>
              <div className="mt-2 flex items-center justify-between gap-3 pl-12">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge status={u.active ? "Active" : "Inactive"} className={u.active ? "" : "text-[var(--muted)]"} />
                  {loginPill(u)}
                </div>
                {actions(u)}
              </div>
            </ClickableRow>
          ))}
        </ul>

        {!visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
              <Icon name="building" />
            </span>
            <p className="text-sm font-semibold">{rows.length ? "No matching partners" : "No partners yet"}</p>
            <p className="text-xs text-[var(--muted)]">
              {rows.length ? "Try a different search or filter." : "Register a partner agency to get started."}
            </p>
          </div>
        ) : null}
      </section>

      <PopupDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${partnerName(editing)}` : ""}
        subtitle={editing ? `Registered ${formatJoined(editing.created_at)}` : undefined}
        busy={pending}
        size="lg"
      >
        {editing ? (
          <form key={editing.id} onSubmit={(e) => onSave(e, editing.id)} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
            <PartnerFields values={editing} />
            <div className="sm:col-span-2">
              <Toggle name="active" defaultChecked={editing.active} label="Active" description="Inactive partners can’t use the portal." />
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
