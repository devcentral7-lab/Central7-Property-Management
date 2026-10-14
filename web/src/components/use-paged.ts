import { useState } from "react";
import { PAGE_SIZE } from "@/lib/constants";

/** Shows `items` PAGE_SIZE at a time; goes back to page 1 whenever `resetKey` (search, filter, sort) changes. */
export function usePaged<T>(items: T[], resetKey: string) {
  const [state, setState] = useState({ page: 1, key: resetKey });
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(state.key === resetKey ? state.page : 1, totalPages);
  return {
    page,
    totalPages,
    items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    setPage: (p: number) => setState({ page: p, key: resetKey }),
  };
}
