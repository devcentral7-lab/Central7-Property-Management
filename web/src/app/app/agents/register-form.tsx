"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerPartner } from "@/app/app/agents/actions";
import { PopupDialog } from "@/components/popup-dialog";
import { CredentialsDialog, type Credentials } from "@/app/app/user-management/dialogs";
import {
  Icon,
  Toggle,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/app/user-management/ui";

export function PartnerFields({
  values,
}: {
  values?: {
    company_name?: string | null;
    contact_person?: string | null;
    contact_number?: string | null;
    email?: string | null;
    username?: string | null;
    address?: string | null;
    status?: string | null;
  };
}) {
  return (
    <>
      <label className={labelClass}>
        Company name
        <input name="company_name" autoComplete="off" defaultValue={values?.company_name ?? ""} className={fieldClass} placeholder="ABC Realty" />
      </label>
      <label className={labelClass}>
        Contact person
        <input name="contact_person" autoComplete="off" defaultValue={values?.contact_person ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Contact number
        <input name="contact_number" type="tel" autoComplete="off" defaultValue={values?.contact_number ?? ""} className={fieldClass} placeholder="077…" />
      </label>
      <label className={labelClass}>
        Email
        <input name="email" type="email" autoComplete="off" defaultValue={values?.email ?? ""} className={fieldClass} placeholder="agent@company.lk" />
      </label>
      <label className={labelClass}>
        Username <span className="text-[var(--brand)]">*</span>
        <input name="username" required autoComplete="off" defaultValue={values?.username ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Approval status
        <select name="status" defaultValue={values?.status ?? "Approved"} className={fieldClass}>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Address
        <textarea name="address" rows={2} defaultValue={values?.address ?? ""} className={fieldClass} />
      </label>
    </>
  );
}

export function RegisterPartnerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerPartner(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setCreds({
        title: "Partner registered",
        subtitle: result.tempPassword ? "Share these sign-in details with the partner." : undefined,
        details: [
          ["Username", result.username],
          ...(result.email ? ([["Email", result.email]] as [string, string][]) : []),
        ],
        email: result.email,
        password: result.tempPassword,
      });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={primaryButtonClass}
      >
        <Icon name="plus" className="h-4 w-4" />
        Add partner
      </button>

      <PopupDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Register partner"
        subtitle="Partner agencies sign in with the Agent role."
        busy={pending}
        size="lg"
      >
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
          <PartnerFields />
          <Toggle name="active" defaultChecked label="Active" description="Partner can use the portal." />
          <Toggle name="create_login" defaultChecked label="Create login" description="Needs an email; generates a temp password." />

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">{error}</p>
          ) : null}

          <div className="flex gap-2 sm:col-span-2 sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={`flex-1 sm:flex-none ${secondaryButtonClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
              {pending ? "Registering…" : "Register partner"}
            </button>
          </div>
        </form>
      </PopupDialog>

      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </>
  );
}
