"use client";

import { useId, useRef, useState } from "react";

export type SearchOption = { value: string; label: string };

/** Type-to-filter dropdown (like the city picker) that submits the chosen option's value. */
export function SearchSelect({
  name,
  value,
  onChange,
  options,
  placeholder,
  emptyLabel = "No matches",
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder: string;
  emptyLabel?: string;
  className: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const selected = options.find((o) => o.value === value);
  const needle = (query ?? "").trim().toLowerCase();
  const matches = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  function close() {
    setOpen(false);
    setQuery(null);
    setActive(-1);
  }

  function select(option: SearchOption) {
    onChange(option.value);
    close();
  }

  function move(index: number) {
    setActive(index);
    setOpen(true);
    document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        ref={input}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={query ?? selected?.label ?? ""}
        className={`${className} pr-10`}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const text = event.target.value;
          setQuery(text);
          setOpen(true);
          setActive(-1);
          if (!text.trim()) onChange("");
        }}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (matches.length) {
              move(event.key === "ArrowDown"
                ? Math.min(active + 1, matches.length - 1)
                : active < 0 ? matches.length - 1 : Math.max(active - 1, 0));
            }
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const option = matches[active] ?? (matches.length === 1 ? matches[0] : undefined);
            if (option) select(option);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Close list" : "Open list"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--ink)]"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) close();
          else {
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
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-white py-1 shadow-lg"
        >
          {matches.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`cursor-pointer px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--bg-accent)] ${
                index === active || option.value === value ? "bg-[var(--bg-accent)]" : ""
              }`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => select(option)}
            >
              {option.label}
            </li>
          ))}
          {!matches.length ? (
            <li role="presentation" className="px-3 py-2 text-sm text-[var(--muted)]">
              {emptyLabel}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
