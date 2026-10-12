"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useTransition, type ReactNode } from "react";

const TYPING_DELAY_MS = 400;
const IMMEDIATE_INPUT_TYPES = new Set(["checkbox", "radio", "date", "month", "range"]);
const CLEAR_GROUP_EVENT = "clear-filter-group";

function groupOf(el: Element | null): string | null {
  return el?.closest("[data-filter-group]")?.getAttribute("data-filter-group") ?? null;
}

/** Whether a "filters-cleared" event covers `el`: a full clear, or a clear of the group containing it. */
export function clearedHere(event: Event, el: Element | null): boolean {
  const group = (event as CustomEvent<{ group?: string } | null>).detail?.group;
  return !group || groupOf(el) === group;
}

/** Clears only the fields inside `data-filter-group={group}` of the LiveFilterForm with this id. */
export function clearFilterGroup(formId: string, group: string) {
  document.getElementById(formId)?.dispatchEvent(new CustomEvent(CLEAR_GROUP_EVENT, { detail: { group } }));
}

type Props = {
  children: ReactNode;
  className?: string;
  /** Lets a reset button outside the form target it via `form={id}`. */
  id?: string;
  /** Path to filter; defaults to the current page. */
  action?: string;
  /** Clear state outside the form, such as a paragraph search prompt. `group` is unset for a full clear. */
  onClear?: (group?: string) => void;
};

/**
 * GET filter form that applies as the user types or picks. Changing a filter drops
 * `page`. A `<button type="reset">` clears every visible field (selects use
 * `data-default-value` or their first option). Fields use `defaultValue`; when the URL changes from outside
 * the form (tabs, sidebar, back button) they re-sync to the server-rendered values.
 */
export function LiveFilterForm({ children, className = "", id, action, onClear }: Props) {
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
      el.value = value ?? el.dataset.defaultValue ?? "";
      if (el.selectedIndex < 0) el.selectedIndex = 0;
    }
  }, [searchParams]);

  function apply() {
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      const input = form.elements.namedItem(key);
      if (typeof value === "string" && (value.trim() || (input instanceof HTMLSelectElement && input.dataset.defaultValue !== undefined))) {
        const raw = input instanceof HTMLInputElement && input.dataset.moneyInput
          ? value.replace(/,/g, "")
          : value;
        params.append(key, raw.trim());
      }
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
    if (el.tagName === "SELECT" || (IMMEDIATE_INPUT_TYPES.has(el.type) && !(el instanceof HTMLInputElement && el.dataset.rangeFilter))) {
      apply();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(apply, TYPING_DELAY_MS);
  }

  function clearFields(group?: string) {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements)) {
      if (group && groupOf(el) !== group) continue;
      if (el instanceof HTMLSelectElement) {
        if (el.dataset.defaultValue !== undefined) el.value = el.dataset.defaultValue;
        else el.selectedIndex = 0;
      } else if (el instanceof HTMLTextAreaElement) {
        el.value = "";
      } else if (el instanceof HTMLInputElement && el.type !== "hidden") {
        // Range handles are controlled by RangeFilter and reset with its bounds.
        if (el.dataset.rangeFilter) continue;
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
      }
    }
    form.dispatchEvent(new CustomEvent("filters-cleared", { detail: group ? { group } : null }));
    onClear?.(group);
    apply();
  }

  const onClearGroup = useEffectEvent((event: Event) => {
    clearFields((event as CustomEvent<{ group: string }>).detail.group);
  });
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = (event: Event) => onClearGroup(event);
    form.addEventListener(CLEAR_GROUP_EVENT, handler);
    return () => form.removeEventListener(CLEAR_GROUP_EVENT, handler);
  }, []);

  return (
    <form
      ref={formRef}
      id={id}
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
