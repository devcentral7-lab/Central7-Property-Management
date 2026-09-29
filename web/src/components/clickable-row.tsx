"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

const INTERACTIVE =
  "a, button, input, select, textarea, label, summary, [role='button'], [data-row-ignore]";

export const ROW_HOVER =
  "cursor-pointer transition-colors hover:bg-[var(--bg-accent)]/70";

type RowTag = "tr" | "li" | "div";

/**
 * Whole-row click target. Clicks on links, buttons and form controls inside
 * the row keep their own behaviour, and selecting text never navigates.
 * Ctrl/Cmd/middle-click asks the caller to open in a new tab.
 */
export function ClickableRow({
  as = "tr",
  className = "",
  disabled = false,
  onActivate,
  children,
}: {
  as?: RowTag;
  className?: string;
  disabled?: boolean;
  onActivate: (newTab: boolean) => void;
  children: ReactNode;
}) {
  function handle(e: MouseEvent<HTMLElement>) {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    const hit = target?.closest(INTERACTIVE);
    if (hit && hit !== e.currentTarget && e.currentTarget.contains(hit)) return;
    if (window.getSelection()?.toString()) return;
    const newTab = e.button === 1 || e.metaKey || e.ctrlKey;
    if (e.button !== 0 && !newTab) return;
    onActivate(newTab);
  }

  const props = disabled
    ? { className }
    : {
        className: `${ROW_HOVER} ${className}`,
        onClick: handle,
        onAuxClick: (e: MouseEvent<HTMLElement>) => {
          if (e.button === 1) handle(e);
        },
      };

  if (as === "li") return <li {...props}>{children}</li>;
  if (as === "div") return <div {...props}>{children}</div>;
  return <tr {...props}>{children}</tr>;
}

export function LinkRow({
  href,
  as,
  className,
  children,
}: {
  href: string;
  as?: RowTag;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <ClickableRow
      as={as}
      className={className}
      onActivate={(newTab) => {
        if (newTab) window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
    >
      {children}
    </ClickableRow>
  );
}
