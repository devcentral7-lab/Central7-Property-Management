"use client";

import { useState } from "react";
import { PopupDialog } from "@/components/popup-dialog";
import {
  Icon,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/app/user-management/ui";

export type Credentials = {
  title: string;
  subtitle?: string;
  details: [label: string, value: string][];
  email?: string | null;
  password?: string | null;
};

/** One-time reveal of a temporary password with copy-to-clipboard. */
export function CredentialsDialog({
  creds,
  onClose,
}: {
  creds: Credentials | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!creds?.password) return;
    const text = [creds.email ? `Email: ${creds.email}` : null, `Temporary password: ${creds.password}`]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <PopupDialog open={!!creds} onClose={onClose} title={creds?.title ?? ""} subtitle={creds?.subtitle}>
      {creds ? (
        <div className="space-y-4">
          {creds.details.length ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {creds.details.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
                  <dd className="truncate font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {creds.password ? (
            <>
              <div className="rounded-xl border border-dashed border-[var(--brand)]/40 bg-[var(--brand)]/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-deep)]">
                  Temporary password
                </p>
                <p className="mt-1 select-all font-mono text-2xl font-semibold tracking-[0.2em]">
                  {creds.password}
                </p>
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <Icon name="key" className="mt-0.5 h-4 w-4 shrink-0" />
                This password is shown only once. Copy it now and share it securely.
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">No login was created.</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`flex-1 ${secondaryButtonClass}`}>
              Done
            </button>
            {creds.password ? (
              <button type="button" onClick={copy} className={`flex-1 ${primaryButtonClass}`}>
                {copied ? "Copied" : "Copy details"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </PopupDialog>
  );
}

export type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  return (
    <PopupDialog open={!!request} onClose={onClose} title={request?.title ?? ""}>
      {request ? (
        <div className="space-y-5">
          <p className="text-sm text-[var(--muted)]">{request.body}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`flex-1 ${secondaryButtonClass}`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                request.onConfirm();
                onClose();
              }}
              className={`flex-1 ${
                request.danger
                  ? "inline-flex items-center justify-center rounded-full bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                  : primaryButtonClass
              }`}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </PopupDialog>
  );
}
