"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createComplex,
  deleteComplex,
  listComplexListings,
  updateComplex,
  type ComplexListItem,
  type ComplexListing,
} from "@/app/app/complexes/actions";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { ClickableRow } from "@/components/clickable-row";
import { PopupDialog } from "@/components/popup-dialog";
import { StatusBadge } from "@/components/status-badge";
import {
  FilterChip,
  Icon,
  Pill,
  SearchBox,
  dangerIconButtonClass,
  fieldClass,
  formatJoined,
  iconButtonClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/app/user-management/ui";

type Filter = "all" | "used" | "unused" | "incomplete";

const dangerButtonClass =
  "inline-flex items-center justify-center rounded-full bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";

function isIncomplete(c: ComplexListItem) {
  return !c.location || !c.amenities.length;
}

function listingsLabel(n: number) {
  return `${n.toLocaleString()} listing${n === 1 ? "" : "s"}`;
}

function ComplexFields({ values, locations }: { values?: ComplexListItem; locations: string[] }) {
  return (
    <>
      <label className={`${labelClass} sm:col-span-2`}>
        Name <span className="text-[var(--brand)]">*</span>
        <input name="name" required autoComplete="off" defaultValue={values?.name ?? ""} className={fieldClass} placeholder="e.g. On320 Residencies" />
      </label>
      <label className={labelClass}>
        Location
        <input name="location" list="complex-locations" autoComplete="off" defaultValue={values?.location ?? ""} className={fieldClass} placeholder="e.g. Colombo-02" />
        <datalist id="complex-locations">
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </label>
      <label className={labelClass}>
        Developer
        <input name="developer" autoComplete="off" defaultValue={values?.developer ?? ""} className={fieldClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Address
        <input name="address" autoComplete="off" defaultValue={values?.address ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Built year
        <input name="built_year" inputMode="numeric" defaultValue={values?.built_year ?? ""} className={fieldClass} placeholder="e.g. 2014" />
      </label>
      <label className={labelClass}>
        Apartments per floor
        <input name="apartments_per_floor" inputMode="numeric" defaultValue={values?.apartments_per_floor ?? ""} className={fieldClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Amenities
        <textarea name="amenities" rows={4} defaultValue={values?.amenities.join("\n") ?? ""} className={fieldClass} placeholder="One per line, e.g. Swimming Pool" />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Notes
        <textarea name="notes" rows={2} defaultValue={values?.notes ?? ""} className={fieldClass} />
      </label>
    </>
  );
}

function FormButtons({ pending, onCancel, label, pendingLabel }: { pending: boolean; onCancel: () => void; label: string; pendingLabel: string }) {
  return (
    <div className="flex gap-2 sm:col-span-2 sm:justify-end">
      <button type="button" onClick={onCancel} disabled={pending} className={`flex-1 sm:flex-none ${secondaryButtonClass}`}>
        Cancel
      </button>
      <button type="submit" disabled={pending} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
        {pending ? pendingLabel : label}
      </button>
    </div>
  );
}

export function AddComplexButton({ locations }: { locations: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createComplex(fd);
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
        Add complex
      </button>
      <PopupDialog open={open} onClose={() => setOpen(false)} title="Add Apartment Complex" busy={pending} size="lg">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
          <ComplexFields locations={locations} />
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">{error}</p> : null}
          <FormButtons pending={pending} onCancel={() => setOpen(false)} label="Add complex" pendingLabel="Adding…" />
        </form>
      </PopupDialog>
    </>
  );
}

export function ComplexesTable({ rows, locations }: { rows: ComplexListItem[]; locations: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewing, setViewing] = useState<ComplexListItem | null>(null);
  const [listings, setListings] = useState<ComplexListing[] | null>(null);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ComplexListItem | null>(null);
  const [deleting, setDeleting] = useState<ComplexListItem | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      used: rows.filter((c) => c.listing_count > 0).length,
      unused: rows.filter((c) => c.listing_count === 0).length,
      incomplete: rows.filter(isIncomplete).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (filter === "used" && !c.listing_count) return false;
      if (filter === "unused" && c.listing_count) return false;
      if (filter === "incomplete" && !isIncomplete(c)) return false;
      if (!q) return true;
      return [c.name, c.location, c.address, c.developer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  function openView(c: ComplexListItem) {
    setViewing(c);
    setListings(null);
    setListingsError(null);
    if (!c.listing_count) {
      setListings([]);
      return;
    }
    void listComplexListings(c.id).then((res) => {
      if (res.ok) setListings(res.rows);
      else setListingsError(res.error);
    });
  }

  function openEdit(c: ComplexListItem) {
    setError(null);
    setViewing(null);
    setEditing(c);
  }

  function openDelete(c: ComplexListItem) {
    setError(null);
    setViewing(null);
    setMoveTo("");
    setDeleting(c);
  }

  function onSave(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("complex_id", id);
    startTransition(async () => {
      const res = await updateComplex(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function onDelete(c: ComplexListItem) {
    setError(null);
    startTransition(async () => {
      const res = await deleteComplex(c.id, moveTo || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDeleting(null);
      router.refresh();
    });
  }

  function actions(c: ComplexListItem) {
    return (
      <div className="flex items-center justify-end gap-0.5" data-row-ignore>
        <button type="button" disabled={pending} onClick={() => openEdit(c)} title="Edit" aria-label={`Edit ${c.name}`} className={iconButtonClass}>
          <Icon name="edit" className="h-4 w-4" />
        </button>
        <button type="button" disabled={pending} onClick={() => openDelete(c)} title="Delete" aria-label={`Delete ${c.name}`} className={dangerIconButtonClass}>
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const usage = (c: ComplexListItem) =>
    c.listing_count ? <Pill tone="green">{listingsLabel(c.listing_count)}</Pill> : <Pill>Unused</Pill>;

  const muted = <span className="text-[var(--muted)]">—</span>;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Complex Directory</h2>
            <p className="text-xs text-[var(--muted)]">Buildings staff can pick when adding an apartment listing.</p>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, location or address" />
        </div>

        <div className="tab-scroll flex gap-2 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <FilterChip active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>All</FilterChip>
          <FilterChip active={filter === "used"} count={counts.used} onClick={() => setFilter("used")}>With listings</FilterChip>
          <FilterChip active={filter === "unused"} count={counts.unused} onClick={() => setFilter("unused")}>Unused</FilterChip>
          <FilterChip active={filter === "incomplete"} count={counts.incomplete} onClick={() => setFilter("incomplete")}>Missing details</FilterChip>
        </div>

        {error && !editing && !deleting ? (
          <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:mx-5">{error}</p>
        ) : null}

        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-[var(--bg)]/60 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Complex</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Built</th>
              <th className="px-4 py-3 font-semibold">Amenities</th>
              <th className="px-4 py-3 font-semibold">Listings</th>
              <th className="px-5 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <ClickableRow key={c.id} className="border-t border-[var(--line)]" onActivate={() => openView(c)}>
                <td className="max-w-[20rem] px-5 py-3">
                  <p className="truncate font-semibold">{c.name}</p>
                  {c.address ? <p className="truncate text-xs text-[var(--muted)]">{c.address}</p> : null}
                </td>
                <td className="px-4 py-3">{c.location || muted}</td>
                <td className="px-4 py-3 tabular-nums">{c.built_year ?? muted}</td>
                <td className="px-4 py-3 tabular-nums">{c.amenities.length || muted}</td>
                <td className="px-4 py-3">{usage(c)}</td>
                <td className="px-5 py-2">{actions(c)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-[var(--line)] md:hidden">
          {visible.map((c) => (
            <ClickableRow key={c.id} as="li" className="px-4 py-3" onActivate={() => openView(c)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {[c.location, c.built_year ? `Built ${c.built_year}` : null].filter(Boolean).join(" · ") || "No location"}
                  </p>
                </div>
                {actions(c)}
              </div>
              <div className="mt-2">{usage(c)}</div>
            </ClickableRow>
          ))}
        </ul>

        {!visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
              <Icon name="building" />
            </span>
            <p className="text-sm font-semibold">{rows.length ? "No matching complexes" : "No complexes yet"}</p>
            <p className="text-xs text-[var(--muted)]">
              {rows.length ? "Try a different search or filter." : "Add an apartment complex to get started."}
            </p>
          </div>
        ) : null}
      </section>

      <PopupDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        subtitle={viewing ? `Added ${formatJoined(viewing.created_at)}${viewing.added_by ? ` by ${viewing.added_by}` : ""}` : undefined}
        size="lg"
      >
        {viewing ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {(
                [
                  ["Location", viewing.location],
                  ["Built year", viewing.built_year],
                  ["Apartments per floor", viewing.apartments_per_floor],
                  ["Developer", viewing.developer],
                  ["Address", viewing.address],
                ] as [string, string | number | null][]
              ).map(([label, value]) => (
                <div key={label} className={`min-w-0 ${label === "Address" ? "col-span-2" : ""}`}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
                  <dd className="font-medium">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Amenities</p>
              {viewing.amenities.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {viewing.amenities.map((a) => (
                    <Pill key={a}>{a}</Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-[var(--muted)]">None recorded.</p>
              )}
            </div>

            {viewing.notes ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Notes</p>
                <p className="mt-1 whitespace-pre-line text-sm">{viewing.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Listings ({viewing.listing_count.toLocaleString()})
              </p>
              {listingsError ? (
                <p className="mt-1 text-sm text-[var(--danger)]">{listingsError}</p>
              ) : listings === null ? (
                <p className="mt-1 text-sm text-[var(--muted)]">Loading…</p>
              ) : listings.length ? (
                <ul className="mt-1.5 max-h-56 divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)]">
                  {listings.map((l) => (
                    <li key={l.ref_no} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <PropertyLink refNo={l.ref_no}>{l.ref_no}</PropertyLink>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {[l.opportunity_type, l.price_total != null ? `${l.currency ?? "LKR"} ${Number(l.price_total).toLocaleString()}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <StatusBadge status={l.status} className="shrink-0 text-xs" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[var(--muted)]">No listings use this complex.</p>
              )}
              {listings && viewing.listing_count > listings.length ? (
                <p className="mt-1 text-xs text-[var(--muted)]">Showing the latest {listings.length}.</p>
              ) : null}
            </div>

            <div className="flex gap-2 sm:justify-end">
              <button type="button" onClick={() => openDelete(viewing)} className={`flex-1 sm:flex-none ${secondaryButtonClass} text-[var(--danger)]`}>
                <Icon name="trash" className="h-4 w-4" />
                Delete
              </button>
              <button type="button" onClick={() => openEdit(viewing)} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
                <Icon name="edit" className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>
        ) : null}
      </PopupDialog>

      <PopupDialog open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} busy={pending} size="lg">
        {editing ? (
          <form key={editing.id} onSubmit={(e) => onSave(e, editing.id)} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
            <ComplexFields values={editing} locations={locations} />
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">{error}</p> : null}
            <FormButtons pending={pending} onCancel={() => setEditing(null)} label="Save changes" pendingLabel="Saving…" />
          </form>
        ) : null}
      </PopupDialog>

      <PopupDialog open={!!deleting} onClose={() => setDeleting(null)} title={deleting ? `Delete ${deleting.name}?` : ""} busy={pending}>
        {deleting ? (
          <div className="space-y-4">
            {deleting.listing_count ? (
              <>
                <p className="text-sm text-[var(--muted)]">
                  {listingsLabel(deleting.listing_count)} use this complex. Move them to another complex, or leave them without one.
                </p>
                <label className={labelClass}>
                  Move listings to
                  <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={fieldClass}>
                    <option value="">No complex</option>
                    {rows
                      .filter((c) => c.id !== deleting.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.location ? ` (${c.location})` : ""}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">No listings use this complex. This cannot be undone.</p>
            )}
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={pending} className={`flex-1 ${secondaryButtonClass}`}>
                Cancel
              </button>
              <button type="button" onClick={() => onDelete(deleting)} disabled={pending} className={`flex-1 ${dangerButtonClass}`}>
                {pending ? "Deleting…" : "Delete complex"}
              </button>
            </div>
          </div>
        ) : null}
      </PopupDialog>
    </>
  );
}
