"use client";

import { useState, useTransition } from "react";
import { deleteProperty } from "@/app/app/actions";

export function DeletePropertyButton({ refNo }: { refNo: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (
      !confirm(
        `Delete listing ${refNo}? This cannot be undone.`,
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("ref_no", refNo);
    setError(null);
    startTransition(async () => {
      const result = await deleteProperty(fd);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-full border border-[var(--danger)] px-4 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
