"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ensureCity } from "@/app/app/cities/actions";
import { useCities } from "@/components/cities-context";
import { clearedHere } from "@/components/live-filter-form";
import { citySpellingKey, stripCountryFromCity } from "@/lib/cities";
import { useCitySuggestions } from "@/hooks/use-city-suggestions";

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
  const allCities = useCities();
  const { suggestions } = useCitySuggestions(allCities, open ? (query ?? "") : null);

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
    const clear = (event: Event) => {
      if (!clearedHere(event, field.current)) return;
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

  function isKnownOrSuggested(text: string) {
    const key = citySpellingKey(text);
    if (!key) return false;
    if (allCities.some((c) => citySpellingKey(c) === key)) return true;
    return suggestions.some((s) => citySpellingKey(s.value) === key);
  }

  function commit(city: string) {
    setSelected(city);
    onChange?.(city);
    if (autoSubmit && field.current) {
      field.current.value = city;
      input.current?.setCustomValidity("");
      field.current.form?.requestSubmit();
    }
  }

  function select(city: string, source: "known" | "google" = "known") {
    const name = stripCountryFromCity(city);
    commit(name);
    setQuery(null);
    setOpen(false);
    setActive(-1);
    input.current?.setCustomValidity("");
    if (source === "google") {
      const known = allCities.some((c) => citySpellingKey(c) === citySpellingKey(name));
      if (!known) void ensureCity(name);
    }
  }

  function move(index: number) {
    setActive(index);
    setOpen(true);
    document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="min-w-0">
      {autoSubmit ? <input ref={field} type="hidden" name="city" defaultValue={defaultValue} /> : null}
      <label
        htmlFor={id}
        className={
          autoSubmit
            ? "block text-sm font-semibold tracking-wide"
            : "block text-[13px] font-semibold tracking-wide text-[var(--ink)]"
        }
      >
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
          placeholder="Search Sri Lanka cities"
          value={query ?? cityValue}
          className={`${className} pr-10`}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            if (autoSubmit) event.stopPropagation();
            const text = event.target.value;
            setOpen(true);
            setActive(-1);
            const match =
              allCities.find((city) => city.toLowerCase() === text.trim().toLowerCase()) ??
              suggestions.find((s) => s.value.toLowerCase() === text.trim().toLowerCase())?.value;
            setQuery(match ?? text);
            if (match) commit(match);
            else if (autoSubmit && !text.trim()) commit("");
            event.target.setCustomValidity(
              !autoSubmit && text && !isKnownOrSuggested(text) ? "Select a city from the list." : "",
            );
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
              if (suggestions.length) {
                move(
                  event.key === "ArrowDown"
                    ? Math.min(active + 1, suggestions.length - 1)
                    : active < 0
                      ? suggestions.length - 1
                      : Math.max(active - 1, 0),
                );
              }
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              const pick =
                suggestions[active] ?? (suggestions.length === 1 ? suggestions[0] : undefined);
              if (pick) select(pick.value, pick.source);
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
            {suggestions.map((city, index) => (
              <li
                key={`${city.source}-${city.value}`}
                id={`${id}-${index}`}
                role="option"
                aria-selected={city.value === cityValue}
                className={`cursor-pointer px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--bg-accent)] ${
                  index === active || city.value === cityValue ? "bg-[var(--bg-accent)]" : ""
                }`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(city.value, city.source)}
              >
                <span className="block truncate">{city.value}</span>
                {city.source === "google" ? (
                  <span className="block text-[11px] text-[var(--muted)]">
                    {city.label !== city.value ? `${city.label.replace(`${city.value} · `, "")} · ` : ""}
                    From Google Maps
                  </span>
                ) : null}
              </li>
            ))}
            {!suggestions.length ? (
              <li role="presentation" className="px-3 py-2 text-sm text-[var(--muted)]">
                {(query ?? "").trim().length >= 2
                  ? "No cities found"
                  : "Type to search Sri Lanka cities"}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
