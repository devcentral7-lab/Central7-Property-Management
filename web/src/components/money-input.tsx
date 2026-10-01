"use client";

import type { InputHTMLAttributes, Ref } from "react";

export function formatMoneyInput(value: string): string {
  const raw = value.replace(/,/g, "");
  if (!/^\d*(\.\d*)?$/.test(raw)) return value;
  const [integer, decimal] = raw.split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (decimal === undefined ? "" : `.${decimal}`);
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  ref?: Ref<HTMLInputElement>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (raw: string) => void;
};

/** Display grouped amounts; callers and form handlers receive numeric text. */
export function MoneyInput({ value, defaultValue, onValueChange, ...props }: Props) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      data-money-input="true"
      pattern="[0-9,]*([.][0-9]*)?"
      value={value === undefined ? undefined : formatMoneyInput(value)}
      defaultValue={defaultValue === undefined ? undefined : formatMoneyInput(defaultValue)}
      onChange={(event) => {
        const input = event.currentTarget;
        const original = input.value;
        const caret = input.selectionStart ?? original.length;
        const digitsBeforeCaret = original.slice(0, caret).replace(/,/g, "").length;
        const formatted = formatMoneyInput(original);
        input.value = formatted;
        let position = 0;
        let count = 0;
        while (position < formatted.length && count < digitsBeforeCaret) {
          if (formatted[position] !== ",") count++;
          position++;
        }
        input.setSelectionRange(position, position);
        onValueChange?.(formatted.replace(/,/g, ""));
      }}
    />
  );
}
