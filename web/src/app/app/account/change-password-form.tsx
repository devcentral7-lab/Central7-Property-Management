"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/app/users/actions";
import {
  Icon,
  fieldClass,
  labelClass,
  primaryButtonClass,
} from "@/app/app/user-management/ui";

const RULES: { label: string; test: (v: string) => boolean; required?: boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8, required: true },
  { label: "Upper and lower case letters", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number", test: (v) => /\d/.test(v) },
  { label: "A symbol (e.g. ! @ # $)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const LEVELS = [
  { label: "Too short", bar: "bg-stone-300", text: "text-[var(--muted)]" },
  { label: "Weak", bar: "bg-red-500", text: "text-red-600" },
  { label: "Fair", bar: "bg-amber-500", text: "text-amber-700" },
  { label: "Good", bar: "bg-emerald-500", text: "text-emerald-700" },
  { label: "Strong", bar: "bg-emerald-600", text: "text-emerald-700" },
];

function strength(v: string) {
  if (!v) return null;
  if (v.length < 8) return 0;
  const extras = RULES.slice(1).filter((r) => r.test(v)).length + (v.length >= 12 ? 1 : 0);
  return Math.min(4, 1 + Math.floor((extras * 3) / 4 + 0.25));
}

function PasswordInput({
  name,
  autoComplete,
  value,
  onChange,
  invalid,
}: {
  name: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={name === "current_password" ? undefined : 8}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        suppressHydrationWarning
        className={`${fieldClass} pr-11 ${invalid ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1 mt-1 flex w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)]"
      >
        <Icon name={visible ? "eyeOff" : "eye"} className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formKey, setFormKey] = useState(0);

  const level = strength(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  const matches = confirm.length > 0 && confirm === next;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await changePassword(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setNext("");
      setConfirm("");
      setFormKey((k) => k + 1);
    });
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid gap-x-6 gap-y-5 md:grid-cols-[minmax(0,1fr)_15rem]" suppressHydrationWarning>
      <div className="space-y-4">
        <label className={labelClass}>
          Current password
          <PasswordInput name="current_password" autoComplete="current-password" />
        </label>

        <div className="border-t border-dashed border-[var(--line)]" />

        <div>
          <label className={labelClass}>
            New password
            <PasswordInput name="new_password" autoComplete="new-password" value={next} onChange={setNext} />
          </label>
          <div className="mt-2 flex items-center gap-3" aria-live="polite">
            <div className="grid flex-1 grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-colors ${
                    level !== null && level >= i ? LEVELS[level].bar : "bg-[var(--bg-accent)]"
                  }`}
                />
              ))}
            </div>
            <span className={`w-16 text-right text-xs font-semibold ${level !== null ? LEVELS[level].text : "text-[var(--muted)]"}`}>
              {level !== null ? LEVELS[level].label : ""}
            </span>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Confirm new password
            <PasswordInput
              name="confirm_password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
              invalid={mismatch}
            />
          </label>
          {mismatch ? (
            <p className="mt-1.5 text-xs font-medium text-red-600">Passwords don’t match yet.</p>
          ) : matches ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Icon name="check" className="h-3.5 w-3.5" /> Passwords match
            </p>
          ) : null}
        </div>

      </div>

      <div className="order-3 space-y-4 md:order-none md:col-start-1">
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        ) : null}
        {success ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Icon name="check" className="h-4 w-4" />
            Password updated. Use it the next time you sign in.
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`w-full sm:w-auto ${primaryButtonClass}`}>
          <Icon name="lock" className="h-4 w-4" />
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>

      <aside className="order-2 h-fit rounded-xl bg-[var(--bg)] p-4 md:order-none md:col-start-2 md:row-span-2 md:row-start-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Password checklist
        </p>
        <ul className="mt-3 space-y-2.5">
          {RULES.map((r) => {
            const ok = r.test(next);
            return (
              <li key={r.label} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                    ok ? "bg-emerald-500 text-white" : "bg-[var(--card)] ring-1 ring-inset ring-[var(--line)]"
                  }`}
                  aria-hidden
                >
                  {ok ? (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m2.5 6.2 2.2 2.2 4.8-4.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span className={ok ? "text-[var(--ink)]" : "text-[var(--muted)]"}>
                  {r.label}
                  {r.required ? <span className="ml-1 text-xs text-[var(--brand)]">required</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
          Longer passphrases are stronger. Don’t reuse a password from another site.
        </p>
      </aside>
    </form>
  );
}
