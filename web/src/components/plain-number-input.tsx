"use client";

import type { InputHTMLAttributes, KeyboardEvent, Ref } from "react";

/** Digits and at most one decimal point — blocks e / E / + / - and letters. */
export function sanitizePlainNumber(value: string): string {
  const [integer, ...rest] = value.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${integer}.${rest.join("")}` : integer;
}

const BLOCKED_KEYS = new Set(["e", "E", "+", "-", ","]);

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  ref?: Ref<HTMLInputElement>;
  /** Called with the sanitized numeric text after each change. */
  onValueChange?: (raw: string) => void;
};

/** Text number field that rejects scientific-notation characters. */
export function PlainNumberInput({ onValueChange, onKeyDown, onChange, ...props }: Props) {
  function blockKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (BLOCKED_KEYS.has(event.key)) event.preventDefault();
    onKeyDown?.(event);
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*([.][0-9]*)?"
      onKeyDown={blockKeys}
      onChange={(event) => {
        const cleaned = sanitizePlainNumber(event.currentTarget.value);
        event.currentTarget.value = cleaned;
        onChange?.(event);
        onValueChange?.(cleaned);
      }}
    />
  );
}
