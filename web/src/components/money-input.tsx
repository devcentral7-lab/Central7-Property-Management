"use client";

import type { InputHTMLAttributes, Ref } from "react";

/** Digits and a single decimal point; anything else typed or pasted is dropped. */
function numericText(value: string): string {
  const [integer, ...rest] = value.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${integer}.${rest.join("")}` : integer;
}

export function formatMoneyInput(value: string): string {
  const raw = numericText(value);
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
        const digitsBeforeCaret = numericText(original.slice(0, caret)).length;
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
