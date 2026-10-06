"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addCity, removeCity, type CityStatsRow } from "@/app/app/cities/actions";
import { ClickableRow } from "@/components/clickable-row";
import { PopupDialog } from "@/components/popup-dialog";
import {
  FilterChip,
  Icon,
  Pill,
  SearchBox,
  dangerIconButtonClass,
  fieldClass,
  iconButtonClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/app/user-management/ui";

type Filter = "all" | "used" | "empty" | "unlisted";
type Sort = "listings" | "active" | "name";

const dangerButtonClass =
  "inline-flex items-center justify-center rounded-full bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";

function listingsLabel(n: number) {
  return `${n.toLocaleString()} listing${n === 1 ? "" : "s"}`;
}

function cityHref(name: string) {
  return `/app/properties?${new URLSearchParams({ city: name, status: "" })}`;
}

export function AddCityButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    startTransition(async () => {
      const res = await addCity(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={primaryButtonClass}
      >
        <Icon name="plus" className="h-4 w-4" />
        Add city
      </button>
      <PopupDialog open={open} onClose={() => setOpen(false)} title="Add City" subtitle="It appears in every city dropdown straight away." busy={pending}>
        <form onSubmit={onSubmit} className="space-y-4" suppressHydrationWarning>
          <label className={labelClass}>
            City name <span className="text-[var(--brand)]">*</span>
            <input name="name" required maxLength={60} autoComplete="off" autoFocus className={fieldClass} placeholder="e.g. Kottawa" />
          </label>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
          <div className="flex gap-2 sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={`flex-1 sm:flex-none ${secondaryButtonClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
              {pending ? "Adding…" : "Add city"}
            </button>
          </div>
        </form>
      </PopupDialog>
    </>
  );
}

export function CitiesTable({ rows }: { rows: CityStatsRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("listings");
  const [removing, setRemoving] = useState<CityStatsRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.total)), [rows]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      used: rows.filter((r) => r.inList && r.total > 0).length,
      empty: rows.filter((r) => r.inList && !r.total).length,
      unlisted: rows.filter((r) => !r.inList).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (filter === "used" && !(r.inList && r.total)) return false;
      if (filter === "empty" && !(r.inList && !r.total)) return false;
      if (filter === "unlisted" && r.inList) return false;
      return !q || r.name.toLowerCase().includes(q);
    });
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "active"
          ? b.active - a.active || b.total - a.total || a.name.localeCompare(b.name)
          : b.total - a.total || a.name.localeCompare(b.name),
    );
  }, [rows, query, filter, sort]);

  function openCity(r: CityStatsRow, newTab: boolean) {
    if (!r.total) return;
    if (newTab) window.open(cityHref(r.name), "_blank", "noopener");
    else router.push(cityHref(r.name));
  }

  function onAdd(r: CityStatsRow) {
    setError(null);
    startTransition(async () => {
      const res = await addCity(r.name);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function onRemove(r: CityStatsRow) {
    setError(null);
    startTransition(async () => {
      const res = await removeCity(r.name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRemoving(null);
      router.refresh();
    });
  }

  function actions(r: CityStatsRow) {
    return (
      <div className="flex items-center justify-end gap-0.5" data-row-ignore>
        {r.inList ? (
          <button type="button" disabled={pending} onClick={() => { setError(null); setRemoving(r); }} title="Remove from list" aria-label={`Remove ${r.name}`} className={dangerIconButtonClass}>
            <Icon name="trash" className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => onAdd(r)} title="Add to list" aria-label={`Add ${r.name} to the list`} className={iconButtonClass}>
            <Icon name="plus" className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  const muted = <span className="text-[var(--muted)]">—</span>;
  const num = (n: number) => (n ? n.toLocaleString() : muted);

  const bar = (r: CityStatsRow) => (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right font-semibold tabular-nums">{r.total.toLocaleString()}</span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
        <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${(r.total / max) * 100}%` }} />
      </span>
    </div>
  );

  const types = (r: CityStatsRow) =>
    r.types.length ? (
      <div className="flex flex-wrap gap-1">
        {r.types.slice(0, 3).map((t) => (
          <Pill key={t.name}>
            {t.name} <span className="tabular-nums text-stone-500">{t.count}</span>
          </Pill>
        ))}
        {r.types.length > 3 ? <Pill>+{r.types.length - 3}</Pill> : null}
      </div>
    ) : (
      muted
    );

  const name = (r: CityStatsRow) => (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold">{r.name}</span>
      {r.inList ? null : <Pill tone="amber">Not on list</Pill>}
    </span>
  );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Listings by City</h2>
            <p className="text-xs text-[var(--muted)]">Click a city to see its listings. Every status is counted.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort cities" className="rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
              <option value="listings">Most listings</option>
              <option value="active">Most active</option>
              <option value="name">A–Z</option>
            </select>
            <SearchBox value={query} onChange={setQuery} placeholder="Search cities" />
          </div>
        </div>

        <div className="tab-scroll flex gap-2 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>All</FilterChip>
          <FilterChip active={filter === "used"} count={counts.used} onClick={() => setFilter("used")}>With listings</FilterChip>
          <FilterChip active={filter === "empty"} count={counts.empty} onClick={() => setFilter("empty")}>No listings</FilterChip>
          <FilterChip active={filter === "unlisted"} count={counts.unlisted} onClick={() => setFilter("unlisted")}>Not on list</FilterChip>
        </div>

        {filter === "unlisted" && counts.unlisted ? (
          <p className="border-b border-[var(--line)] bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900 sm:px-5">
            These city names are on listings but not in the dropdown, usually from older data or spelling differences. Add one to make it selectable.
          </p>
        ) : null}

        {error && !removing ? (
          <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:mx-5">{error}</p>
        ) : null}

        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-[var(--bg)]/60 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Listings</th>
              <th className="px-4 py-3 font-semibold">Active</th>
              <th className="px-4 py-3 font-semibold">For sale</th>
              <th className="px-4 py-3 font-semibold">For rent</th>
              <th className="px-4 py-3 font-semibold">Property types</th>
              <th className="px-5 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <ClickableRow key={r.name} className="border-t border-[var(--line)]" disabled={!r.total} onActivate={(newTab) => openCity(r, newTab)}>
                <td className="max-w-[16rem] px-5 py-3">{name(r)}</td>
                <td className="px-4 py-3">{bar(r)}</td>
                <td className="px-4 py-3 tabular-nums">{num(r.active)}</td>
                <td className="px-4 py-3 tabular-nums">{num(r.sell)}</td>
                <td className="px-4 py-3 tabular-nums">{num(r.rent)}</td>
                <td className="px-4 py-3">{types(r)}</td>
                <td className="px-5 py-2">{actions(r)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-[var(--line)] md:hidden">
          {visible.map((r) => (
            <ClickableRow key={r.name} as="li" className="px-4 py-3" disabled={!r.total} onActivate={(newTab) => openCity(r, newTab)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {name(r)}
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {r.total
                      ? `${listingsLabel(r.total)} · ${r.active.toLocaleString()} active · ${r.sell.toLocaleString()} sale · ${r.rent.toLocaleString()} rent`
                      : "No listings"}
                  </p>
                </div>
                {actions(r)}
              </div>
              {r.types.length ? <div className="mt-2">{types(r)}</div> : null}
            </ClickableRow>
          ))}
        </ul>

        {!visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
              <Icon name="pin" />
            </span>
            <p className="text-sm font-semibold">{rows.length ? "No matching cities" : "No cities yet"}</p>
            <p className="text-xs text-[var(--muted)]">{rows.length ? "Try a different search or filter." : "Add a city to get started."}</p>
          </div>
        ) : null}
      </section>

      <PopupDialog open={!!removing} onClose={() => setRemoving(null)} title={removing ? `Remove ${removing.name}?` : ""} busy={pending}>
        {removing ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              {removing.total
                ? `${listingsLabel(removing.total)} use this city. They keep it, but staff can no longer pick ${removing.name} for new listings or filters.`
                : `No listings use this city. Staff can no longer pick it for new listings or filters.`}
            </p>
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setRemoving(null)} disabled={pending} className={`flex-1 ${secondaryButtonClass}`}>
                Cancel
              </button>
              <button type="button" onClick={() => onRemove(removing)} disabled={pending} className={`flex-1 ${dangerButtonClass}`}>
                {pending ? "Removing…" : "Remove city"}
              </button>
            </div>
          </div>
        ) : null}
      </PopupDialog>
    </>
  );
}
