"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactNode } from "react";

const TYPING_DELAY_MS = 400;
const IMMEDIATE_INPUT_TYPES = new Set(["checkbox", "radio", "date", "month", "range"]);

type Props = {
  children: ReactNode;
  className?: string;
  /** Path to filter; defaults to the current page. */
  action?: string;
};

/**
 * GET filter form that applies as the user types or picks. Changing a filter drops
 * `page`. A `<button type="reset">` clears every visible field (selects go to
 * their first option). Fields use `defaultValue`; when the URL changes from outside
 * the form (tabs, sidebar, back button) they re-sync to the server-rendered values.
 */
export function LiveFilterForm({ children, className = "", action }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(new Set<string>());
  const syncing = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const qs = searchParams.toString();
    if (requested.current.has(qs)) return;
    requested.current.clear();
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    syncing.current = true;
    form.reset();
    syncing.current = false;
    // React doesn't apply defaultValue changes to <select> after mount.
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLSelectElement) || !el.name) continue;
      const value = searchParams.get(el.name);
      el.value = value ?? "";
      if (el.selectedIndex < 0) el.selectedIndex = 0;
    }
  }, [searchParams]);

  function apply() {
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim()) params.append(key, value.trim());
    }
    const qs = params.toString();
    const path = action ?? pathname;
    if (path === window.location.pathname && qs === window.location.search.slice(1)) return;
    requested.current.add(qs);
    startTransition(() => {
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    });
  }

  function onChange(target: EventTarget) {
    const el = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (el.tagName === "SELECT" || IMMEDIATE_INPUT_TYPES.has(el.type)) {
      apply();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(apply, TYPING_DELAY_MS);
  }

  function clearFields() {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLSelectElement) {
        el.selectedIndex = 0;
      } else if (el instanceof HTMLTextAreaElement) {
        el.value = "";
      } else if (el instanceof HTMLInputElement && el.type !== "hidden") {
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
      }
    }
    apply();
  }

  return (
    <form
      ref={formRef}
      role="search"
      aria-busy={pending}
      className={`relative ${className}`}
      onChange={(e) => onChange(e.target)}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onReset={(e) => {
        if (syncing.current) return;
        e.preventDefault();
        clearFields();
      }}
    >
      {children}
      {pending ? (
        <span className="pointer-events-none absolute -top-2.5 right-4 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
          Updating…
        </span>
      ) : null}
    </form>
  );
}
