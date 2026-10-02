"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LEGACY_CITIES } from "@/lib/cities";

export function CitySelect({
  value,
  onChange,
  className,
  defaultValue = "",
  autoSubmit = false,
}: {
  value?: string;
  onChange?: (city: string) => void;
  className: string;
  defaultValue?: string;
  /** Optional city filter that submits its form after selecting a city. */
  autoSubmit?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(defaultValue);
  const cityValue = value ?? selected;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const cities = LEGACY_CITIES.filter((city) =>
    city.toLowerCase().includes((query ?? "").trim().toLowerCase()),
  );

  useEffect(() => {
    if (!autoSubmit) return;
    const form = field.current?.form;
    if (!form) return;
    const sync = () => {
      setSelected(field.current?.value ?? "");
      setQuery(null);
      setOpen(false);
      setActive(-1);
      input.current?.setCustomValidity("");
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
  }, [autoSubmit]);

  function commit(city: string) {
    setSelected(city);
    onChange?.(city);
    if (autoSubmit && field.current) {
      field.current.value = city;
      input.current?.setCustomValidity("");
      field.current.form?.requestSubmit();
    }
  }

  function select(city: string) {
    commit(city);
    setQuery(null);
    setOpen(false);
    setActive(-1);
    input.current?.setCustomValidity("");
  }

  function move(index: number) {
    setActive(index);
    setOpen(true);
    document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="min-w-0">
      {autoSubmit ? <input ref={field} type="hidden" name="city" defaultValue={defaultValue} /> : null}
      <label htmlFor={id} className={autoSubmit ? "block text-sm font-medium" : "block text-[13px] font-medium text-[var(--ink)]"}>
        City{!autoSubmit ? <span className="ml-0.5 text-[var(--brand)]" aria-hidden>*</span> : null}
      </label>
      <div className="relative mt-1.5">
        <input
          ref={input}
          id={id}
          name={autoSubmit ? undefined : "city"}
          required={!autoSubmit}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
          autoComplete="off"
          placeholder="Select city"
          value={query ?? cityValue}
          className={`${className} pr-10`}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            if (autoSubmit) event.stopPropagation();
            const text = event.target.value;
            setOpen(true);
            setActive(-1);
            const match = LEGACY_CITIES.find((city) => city.toLowerCase() === text.trim().toLowerCase());
            setQuery(match ?? text);
            if (match) commit(match);
            else if (autoSubmit && !text.trim()) commit("");
            event.target.setCustomValidity(!autoSubmit && text && !match ? "Select a city from the list." : "");
          }}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
            setActive(-1);
            input.current?.setCustomValidity("");
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (cities.length) {
                move(event.key === "ArrowDown"
                  ? Math.min(active + 1, cities.length - 1)
                  : active < 0 ? cities.length - 1 : Math.max(active - 1, 0));
              }
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              const city = cities[active] ?? (cities.length === 1 ? cities[0] : undefined);
              if (city) select(city);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setQuery(null);
              setActive(-1);
              input.current?.setCustomValidity("");
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close city dropdown" : "Open city dropdown"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--ink)]"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              input.current?.focus();
              setQuery(null);
              setActive(-1);
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
            aria-label="Cities"
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-white py-1 shadow-lg"
          >
            {cities.map((city, index) => (
              <li
                key={city}
                id={`${id}-${index}`}
                role="option"
                aria-selected={city === cityValue}
                className={`cursor-pointer px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--bg-accent)] ${index === active || city === cityValue ? "bg-[var(--bg-accent)]" : ""}`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(city)}
              >
                {city}
              </li>
            ))}
            {!cities.length ? (
              <li role="presentation" className="px-3 py-2 text-sm text-[var(--muted)]">No cities found</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
