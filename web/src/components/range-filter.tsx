"use client";

import { useEffect, useRef, useState } from "react";
import { MoneyInput, formatMoneyInput } from "@/components/money-input";

type Props = {
  label: string;
  minName: string;
  maxName: string;
  defaultMin: string;
  defaultMax: string;
  ceiling: number;
  step?: number;
  money?: boolean;
  /** Show slider labels in millions, e.g. "1,000 Mn". */
  millions?: boolean;
  inputClassName: string;
};

function sliderLabel(n: number, millions: boolean) {
  return millions
    ? `${(n / 1_000_000).toLocaleString("en-US")} Mn`
    : n.toLocaleString("en-US");
}

function amount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function RangeFilter({ label, minName, maxName, defaultMin, defaultMax, ceiling, step = 1, money = false, millions = false, inputClassName }: Props) {
  const minimum = useRef<HTMLInputElement>(null);
  const maximum = useRef<HTMLInputElement>(null);
  const [bounds, setBounds] = useState(() => [amount(defaultMin), amount(defaultMax)]);
  const limit = Math.max(ceiling, bounds[0] ?? 0, bounds[1] ?? 0);
  const low = bounds[0] ?? 0;
  const high = Math.max(low, bounds[1] ?? limit);

  // Native form resets and Clear filters also update the slider handles.
  useEffect(() => {
    const form = minimum.current?.form;
    if (!form) return;
    const sync = () => queueMicrotask(() => {
      setBounds([amount(minimum.current?.value ?? ""), amount(maximum.current?.value ?? "")]);
    });
    const clear = () => setBounds([null, null]);
    form.addEventListener("reset", sync);
    form.addEventListener("filters-cleared", clear);
    return () => {
      form.removeEventListener("reset", sync);
      form.removeEventListener("filters-cleared", clear);
    };
  }, []);

  function slide(index: number, value: number) {
    const next = index === 0 ? Math.min(value, high) : Math.max(value, low);
    const input = index === 0 ? minimum.current : maximum.current;
    if (input) input.value = money ? formatMoneyInput(String(next)) : String(next);
    setBounds((previous) => previous.map((bound, i) => i === index ? next : bound));
  }

  function typeBound(index: number, raw: string) {
    const value = amount(raw);
    const next = [...bounds];
    next[index] = value;
    const other = bounds[1 - index];
    if (value !== null && other !== null && (index === 0 ? value > other : value < other)) {
      const input = index === 0 ? maximum.current : minimum.current;
      if (input) input.value = money ? formatMoneyInput(raw) : raw;
      next[1 - index] = value;
    }
    setBounds(next);
  }

  return (
    <fieldset className="flex min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
      <legend className="sr-only">{label} Range</legend>
      <p aria-hidden="true" className="mb-3 text-sm font-semibold leading-5">{label} Range</p>
      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as const).map((index) => {
          const props = {
            ref: index === 0 ? minimum : maximum,
            name: index === 0 ? minName : maxName,
            defaultValue: index === 0 ? defaultMin : defaultMax,
            className: `${inputClassName} mt-1 h-10`,
            placeholder: index === 0 ? "No minimum" : "No maximum",
          };
          const update = (raw: string) => typeBound(index, raw);
          return (
            <label key={index} className="min-w-0 text-xs font-medium leading-5 text-[var(--muted)]">
              {index === 0 ? "Min" : "Max"}
              {money ? <MoneyInput {...props} onValueChange={update} /> : (
                <input {...props} type="number" min="0" step="any" onChange={(event) => update(event.currentTarget.value)} />
              )}
            </label>
          );
        })}
      </div>
      <div className="relative mx-2 mt-4 h-8">
        <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-stone-200" />
        <div className="absolute top-3 h-1.5 rounded-full bg-[var(--brand)]" style={{ left: `${low / limit * 100}%`, right: `${100 - high / limit * 100}%` }} />
        {([0, 1] as const).map((index) => (
          <input
            key={index}
            type="range"
            min={0}
            max={limit}
            step={step}
            value={index === 0 ? low : high}
            aria-label={`${label} ${index === 0 ? "minimum" : "maximum"}`}
            aria-valuetext={sliderLabel(index === 0 ? low : high, millions)}
            data-range-filter="true"
            className="range-filter-handle absolute inset-x-0 top-0 h-8 w-full"
            style={{ zIndex: index === 0 && low === limit ? 2 : index }}
            onChange={(event) => slide(index, Number(event.currentTarget.value))}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-[var(--muted)]">
        <span>{sliderLabel(0, millions)}</span>
        <span>{sliderLabel(limit, millions)}</span>
      </div>
    </fieldset>
  );
}
