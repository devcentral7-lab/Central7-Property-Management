"use client";

import { useTransition } from "react";
import { deleteProperty } from "@/app/app/actions";

export function DeletePropertyButton({ refNo }: { refNo: string }) {
  const [pending, startTransition] = useTransition();

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
    startTransition(async () => {
      await deleteProperty(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="rounded-full border border-[var(--danger)] px-4 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
