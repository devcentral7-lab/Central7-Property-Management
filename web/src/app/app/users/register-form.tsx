"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerStaffUser } from "@/app/app/users/actions";
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

export function RegisterStaffForm() {
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
      const result = await registerStaffUser(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setCreds({
        title: "Account created",
        subtitle: "Share these sign-in details with the new user.",
        details: [
          ["Name", result.display_name],
          ["Role", result.role],
          ["Email", result.email],
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
        <Icon name="userPlus" className="h-4 w-4" />
        Add staff user
      </button>

      <PopupDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Register staff user"
        subtitle="A 10-digit temporary password is generated automatically."
        busy={pending}
        size="lg"
      >
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
          <label className={labelClass}>
            Display name <span className="text-[var(--brand)]">*</span>
            <input name="display_name" required autoComplete="off" autoFocus className={fieldClass} placeholder="Chaminda" />
          </label>
          <label className={labelClass}>
            Email <span className="text-[var(--brand)]">*</span>
            <input name="email" type="email" required autoComplete="off" className={fieldClass} placeholder="name@central7.lk" />
          </label>
          <label className={labelClass}>
            Phone
            <input name="mobile_number" type="tel" autoComplete="off" className={fieldClass} placeholder="077…" />
          </label>
          <label className={labelClass}>
            Role <span className="text-[var(--brand)]">*</span>
            <select name="role" defaultValue="User" className={fieldClass}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <Toggle name="active" defaultChecked label="Active" description="Active users can sign in straight away." />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">{error}</p>
          ) : null}

          <div className="flex gap-2 sm:col-span-2 sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={`flex-1 sm:flex-none ${secondaryButtonClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
              {pending ? "Registering…" : "Register user"}
            </button>
          </div>
        </form>
      </PopupDialog>

      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </>
  );
}
