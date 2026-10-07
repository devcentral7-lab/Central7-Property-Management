"use client";

import { useEffect, useId, useRef, useState } from "react";
import { splitListParam } from "@/lib/list-param";

export type MultiSelectOption = { value: string; label: string };

/**
 * Multi-select for a GET filter form: submits `name` as a comma-separated list
 * of option values and submits the form after every change.
 */
export function MultiSelectFilter({
  name,
  label,
  options,
  defaultValue = "",
  allLabel,
  addLabel,
  emptyLabel,
  className = "",
}: {
  name: string;
  label: string;
  options: readonly MultiSelectOption[];
  defaultValue?: string;
  /** Placeholder when nothing is selected, e.g. "All cities". */
  allLabel: string;
  /** Placeholder once something is selected, e.g. "Add city". */
  addLabel: string;
  emptyLabel: string;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(() => splitListParam(defaultValue));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const term = query.trim().toLowerCase();
  const visible = options.filter((o) => o.label.toLowerCase().includes(term));
  const labelOf = (value: string) => options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    const form = field.current?.form;
    if (!form) return;
    const sync = () => {
      setSelected(splitListParam(field.current?.value ?? ""));
      setQuery("");
      setOpen(false);
      setActive(-1);
    };
    const reset = () => queueMicrotask(sync);
    const clear = () => {
      if (field.current) field.current.value = "";
      sync();
    };
    form.addEventListener("reset", reset);
    form.addEventListener("filters-cleared", clear);
    return () => {
      form.removeEventListener("reset", reset);
      form.removeEventListener("filters-cleared", clear);
    };
  }, []);

  function commit(next: string[]) {
    setSelected(next);
    if (field.current) {
      field.current.value = next.join(",");
      field.current.form?.requestSubmit();
    }
  }

  function toggle(value: string) {
    commit(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    setQuery("");
    input.current?.focus();
  }

  function move(index: number) {
    setActive(index);
    setOpen(true);
    document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <input ref={field} type="hidden" name={name} defaultValue={defaultValue} />
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1">
        <div
          className="flex min-h-[38px] w-full cursor-text flex-wrap items-center gap-1 rounded-xl border border-[var(--line)] bg-white py-1 pl-1.5 pr-9 text-sm focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]/15"
          onClick={() => input.current?.focus()}
        >
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--brand)]/10 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-[var(--brand-deep)]"
            >
              <span className="truncate">{labelOf(value)}</span>
              <button
                type="button"
                aria-label={`Remove ${labelOf(value)}`}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-[var(--brand)]/20"
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(value);
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5" aria-hidden>
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </span>
          ))}
          <input
            ref={input}
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
            autoComplete="off"
            placeholder={selected.length ? addLabel : allLabel}
            value={query}
            className="min-w-[5rem] flex-1 bg-transparent px-1.5 py-1 outline-none"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              event.stopPropagation();
              setQuery(event.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onBlur={() => {
              setOpen(false);
              setQuery("");
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (visible.length) {
                  move(event.key === "ArrowDown"
                    ? Math.min(active + 1, visible.length - 1)
                    : active < 0 ? visible.length - 1 : Math.max(active - 1, 0));
                }
              } else if (event.key === "Enter") {
                event.preventDefault();
                const option = visible[active] ?? (visible.length === 1 ? visible[0] : undefined);
                if (open && option) toggle(option.value);
              } else if (event.key === "Backspace" && !query && selected.length) {
                commit(selected.slice(0, -1));
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setQuery("");
                setActive(-1);
              }
            }}
          />
        </div>
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? `Close ${label.toLowerCase()} dropdown` : `Open ${label.toLowerCase()} dropdown`}
          className="absolute right-0 top-0 flex h-[38px] w-9 items-center justify-center text-[var(--ink)]"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              input.current?.focus();
              setOpen(true);
            }
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden>
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        {open ? (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-white py-1 shadow-lg"
          >
            {visible.map((option, index) => {
              const checked = selected.includes(option.value);
              return (
                <li
                  key={option.value}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={checked}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--bg-accent)] ${index === active ? "bg-[var(--bg-accent)]" : ""}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => toggle(option.value)}
                >
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-stone-300 bg-white"
                    }`}
                  >
                    {checked ? (
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3">
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    ) : null}
                  </span>
                  {option.label}
                </li>
              );
            })}
            {!visible.length ? (
              <li role="presentation" className="px-3 py-2 text-sm text-[var(--muted)]">{emptyLabel}</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
