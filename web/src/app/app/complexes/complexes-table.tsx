"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type InputHTMLAttributes, type ReactNode } from "react";
import {
  createComplex,
  deleteComplex,
  listComplexListings,
  updateComplex,
  type ComplexListItem,
  type ComplexListing,
} from "@/app/app/complexes/actions";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { CitySelect } from "@/components/city-select";
import { ClickableRow } from "@/components/clickable-row";
import { Pager } from "@/components/pager";
import { PopupDialog } from "@/components/popup-dialog";
import { usePaged } from "@/components/use-paged";
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

const complexLabelClass = "block text-sm font-semibold";
const complexFieldClass = `${fieldClass} font-normal`;

const AVAILABILITY = ["Available", "Not Available"] as const;
const YES_NO = ["Yes", "No"] as const;

function isIncomplete(c: ComplexListItem) {
  return !c.location || !c.amenities.length;
}

function listingsLabel(n: number) {
  return `${n.toLocaleString()} listing${n === 1 ? "" : "s"}`;
}

function buildingAge(builtYear: string | number | null | undefined): string {
  const year = Number(builtYear);
  if (!Number.isInteger(year) || year < 1900) return "";
  const age = new Date().getFullYear() - year;
  if (age < 0) return "Not yet built";
  return age === 1 ? "1 year" : `${age} years`;
}

/** Split saved tower/wing names (joined with ·, commas, or newlines). */
function splitTowerNames(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\n+| · |,|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function SelectOptions({
  options,
  blank = "—",
}: {
  options: readonly string[];
  blank?: string;
}) {
  return (
    <>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </>
  );
}

function AmenityChip({
  children,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal transition hover:border-stone-300 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5">
      <input type="checkbox" {...inputProps} className="h-4 w-4 shrink-0 accent-[var(--brand)]" />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}

function ComplexFields({
  values,
  amenityOptions,
}: {
  values?: ComplexListItem;
  amenityOptions: string[];
}) {
  const [builtYear, setBuiltYear] = useState(values?.built_year != null ? String(values.built_year) : "");
  const [maintenanceType, setMaintenanceType] = useState(values?.maintenance_type ?? "");
  const savedTowerNames = useMemo(() => splitTowerNames(values?.tower_wing_name), [values?.tower_wing_name]);
  const [towerCount, setTowerCount] = useState(() => {
    if (values?.towers_wings != null) return String(values.towers_wings);
    return savedTowerNames.length ? String(savedTowerNames.length) : "";
  });
  const [towerNames, setTowerNames] = useState<string[]>(() => {
    const n = Math.max(values?.towers_wings ?? savedTowerNames.length, savedTowerNames.length, 0);
    if (n <= 0) return savedTowerNames.length ? savedTowerNames : [""];
    return Array.from({ length: n }, (_, i) => savedTowerNames[i] ?? "");
  });
  const listed = useMemo(() => new Set(amenityOptions), [amenityOptions]);
  const initialKnown = useMemo(
    () => (values?.amenities ?? []).filter((a) => listed.has(a)),
    [values?.amenities, listed],
  );
  const initialExtras = useMemo(
    () => (values?.amenities ?? []).filter((a) => !listed.has(a)).join(", "),
    [values?.amenities, listed],
  );
  const [amenityChecks, setAmenityChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(amenityOptions.map((a) => [a, initialKnown.includes(a)])),
  );
  const age = buildingAge(builtYear);
  const towerSlots = Math.min(100, Math.max(0, Number(towerCount) || 0));

  function setTowerCountValue(raw: string) {
    setTowerCount(raw);
    const n = Math.min(100, Math.max(0, Number(raw) || 0));
    setTowerNames((prev) => {
      if (n <= 0) return prev.length ? prev : [""];
      if (prev.length === n) return prev;
      if (prev.length < n) return [...prev, ...Array.from({ length: n - prev.length }, () => "")];
      return prev.slice(0, n);
    });
  }

  return (
    <>
      <label className={`${complexLabelClass} sm:col-span-2`}>
        Name <span className="text-[var(--brand)]">*</span>
        <input name="name" required autoComplete="off" defaultValue={values?.name ?? ""} className={complexFieldClass} placeholder="e.g. On320 Residencies" />
      </label>
      <div className="min-w-0 [&_label]:!mt-0 [&_.relative]:!mt-1">
        <CitySelect
          name="location"
          defaultValue={values?.location ?? ""}
          className={complexFieldClass.replace(/^mt-1\s+/, "")}
          required={false}
        />
      </div>
      <label className={complexLabelClass}>
        Developer
        <input name="developer" autoComplete="off" defaultValue={values?.developer ?? ""} className={complexFieldClass} />
      </label>
      <label className={`${complexLabelClass} sm:col-span-2`}>
        Address
        <input name="address" autoComplete="off" defaultValue={values?.address ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        Built Year
        <input
          name="built_year"
          inputMode="numeric"
          value={builtYear}
          onChange={(e) => setBuiltYear(e.target.value)}
          className={complexFieldClass}
          placeholder="e.g. 2014"
        />
      </label>
      <label className={complexLabelClass}>
        Age of the Building
        <input readOnly value={age} className={`${complexFieldClass} bg-[var(--bg)] text-[var(--muted)]`} placeholder="Calculated from built year" />
      </label>
      <label className={complexLabelClass}>
        Apartments Per Floor
        <input name="apartments_per_floor" inputMode="numeric" defaultValue={values?.apartments_per_floor ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        No of Floors
        <input name="number_of_floors" inputMode="numeric" defaultValue={values?.number_of_floors ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        COC
        <select name="coc" defaultValue={values?.coc ?? ""} className={complexFieldClass}>
          <SelectOptions options={YES_NO} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Deed
        <select name="deed" defaultValue={values?.deed ?? ""} className={complexFieldClass}>
          <SelectOptions options={YES_NO} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Lifts
        <select name="lifts" defaultValue={values?.lifts != null ? String(values.lifts) : ""} className={complexFieldClass}>
          <option value="">—</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>
      <label className={complexLabelClass}>
        Service Lift
        <select name="service_lift" defaultValue={values?.service_lift ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        How Many Towers / Wings
        <input
          name="towers_wings"
          inputMode="numeric"
          value={towerCount}
          onChange={(e) => setTowerCountValue(e.target.value)}
          className={complexFieldClass}
          placeholder="e.g. 3"
        />
      </label>
      <div className={`${towerSlots > 1 ? "sm:col-span-2" : ""} grid gap-3 ${towerSlots > 1 ? "sm:grid-cols-2" : ""}`}>
        {(towerSlots > 0 ? towerNames.slice(0, towerSlots) : [towerNames[0] ?? ""]).map((name, index) => (
          <label key={index} className={complexLabelClass}>
            {towerSlots > 1 ? `Tower / Wing ${index + 1} Name` : "Name of the Tower / Wing"}
            <input
              name="tower_wing_name"
              autoComplete="off"
              value={name}
              onChange={(e) =>
                setTowerNames((prev) => {
                  const next = [...prev];
                  next[index] = e.target.value;
                  return next;
                })
              }
              className={complexFieldClass}
              placeholder={towerSlots > 1 ? `e.g. Tower ${index + 1}` : "e.g. East Wing"}
            />
          </label>
        ))}
      </div>
      <label className={`${complexLabelClass} sm:col-span-2`}>
        Apartment Types
        <input
          name="apartment_types"
          autoComplete="off"
          defaultValue={(values?.apartment_types ?? []).join(", ")}
          className={complexFieldClass}
          placeholder="e.g. Type A, Type B, Type C"
        />
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Comma-separated type names</span>
      </label>
      <label className={complexLabelClass}>
        How Many Swimming Pools
        <input name="swimming_pools_count" inputMode="numeric" defaultValue={values?.swimming_pools_count ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        Swimming Pool Floor
        <input name="swimming_pools_floor" autoComplete="off" defaultValue={values?.swimming_pools_floor ?? ""} className={complexFieldClass} placeholder="e.g. Ground / 3" />
      </label>
      <label className={complexLabelClass}>
        Gym Floor
        <input name="gym_floor" autoComplete="off" defaultValue={values?.gym_floor ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        Generator
        <select name="generator" defaultValue={values?.generator ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Guard Room
        <select name="guard_room" defaultValue={values?.guard_room ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Common Hall
        <select name="common_hall" defaultValue={values?.common_hall ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Drivers Washroom
        <select name="drivers_washroom" defaultValue={values?.drivers_washroom ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Maids Washroom
        <select name="maids_washroom" defaultValue={values?.maids_washroom ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Contact Number 1 (Management / Admin)
        <input name="contact_management" inputMode="tel" autoComplete="off" defaultValue={values?.contact_management ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        Contact Number 2 (Security)
        <input name="contact_security" inputMode="tel" autoComplete="off" defaultValue={values?.contact_security ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        Parking
        <select name="parking_type" defaultValue={values?.parking_type ?? ""} className={complexFieldClass}>
          <SelectOptions options={["Dedicated parking", "First come first serve"]} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Parking Floors
        <input name="parking_floors" autoComplete="off" defaultValue={values?.parking_floors ?? ""} className={complexFieldClass} />
      </label>
      <label className={complexLabelClass}>
        Parking Lift
        <select name="parking_lift" defaultValue={values?.parking_lift ?? ""} className={complexFieldClass}>
          <SelectOptions options={AVAILABILITY} />
        </select>
      </label>
      <label className={complexLabelClass}>
        Maintenance Charges
        <input
          name="maintenance_charges"
          autoComplete="off"
          defaultValue={values?.maintenance_charges ?? ""}
          className={complexFieldClass}
          placeholder="Monthly or per sq.ft price"
        />
      </label>
      <label className={complexLabelClass}>
        Maintenance
        <select
          name="maintenance_type"
          value={maintenanceType}
          onChange={(e) => setMaintenanceType(e.target.value)}
          className={complexFieldClass}
        >
          <SelectOptions options={["Outsourced", "Committee"]} />
        </select>
      </label>
      {maintenanceType === "Outsourced" ? (
        <label className={`${complexLabelClass} sm:col-span-2`}>
          Maintenance Company
          <input name="maintenance_company" autoComplete="off" defaultValue={values?.maintenance_company ?? ""} className={complexFieldClass} />
        </label>
      ) : null}
      <label className={`${complexLabelClass} sm:col-span-2`}>
        Google Pin
        <input name="google_pin" autoComplete="off" defaultValue={values?.google_pin ?? ""} className={complexFieldClass} placeholder="Google Maps link" />
      </label>
      <div className="sm:col-span-2">
        <p className={complexLabelClass}>Amenities</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {amenityOptions.map((a) => (
            <AmenityChip
              key={a}
              name="amenity"
              value={a}
              checked={Boolean(amenityChecks[a])}
              onChange={(e) =>
                setAmenityChecks((prev) => ({
                  ...prev,
                  [a]: e.target.checked,
                }))
              }
            >
              {a}
            </AmenityChip>
          ))}
        </div>
        <label className={`${complexLabelClass} mt-4`}>
          Other Amenities
          <input
            name="amenities"
            autoComplete="off"
            defaultValue={initialExtras}
            className={complexFieldClass}
            placeholder="Any extras not listed above (comma-separated)"
          />
        </label>
      </div>
      <label className={`${complexLabelClass} sm:col-span-2`}>
        Notes
        <textarea name="notes" rows={2} defaultValue={values?.notes ?? ""} className={complexFieldClass} />
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

export function AddComplexButton({ amenityOptions }: { amenityOptions: string[] }) {
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
      <PopupDialog open={open} onClose={() => setOpen(false)} title="Add Apartment Complex" busy={pending} size="xl">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
          <ComplexFields amenityOptions={amenityOptions} />
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">{error}</p> : null}
          <FormButtons pending={pending} onCancel={() => setOpen(false)} label="Add complex" pendingLabel="Adding…" />
        </form>
      </PopupDialog>
    </>
  );
}

export function ComplexesTable({
  rows,
  amenityOptions,
  canManage = false,
}: {
  rows: ComplexListItem[];
  amenityOptions: string[];
  canManage?: boolean;
}) {
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
  const paged = usePaged(visible, `${query}|${filter}`);

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
    if (!canManage) return;
    setError(null);
    setViewing(null);
    setEditing(c);
  }

  function openDelete(c: ComplexListItem) {
    if (!canManage) return;
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
    if (!canManage) return null;
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
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, city or address" />
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
              <th className="px-4 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Built</th>
              <th className="px-4 py-3 font-semibold">Amenities</th>
              <th className="px-4 py-3 font-semibold">Listings</th>
              {canManage ? <th className="px-5 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th> : null}
            </tr>
          </thead>
          <tbody>
            {paged.items.map((c) => (
              <ClickableRow key={c.id} className="border-t border-[var(--line)]" onActivate={() => openView(c)}>
                <td className="max-w-[20rem] px-5 py-3">
                  <p className="truncate font-semibold">{c.name}</p>
                  {c.address ? <p className="truncate text-xs text-[var(--muted)]">{c.address}</p> : null}
                </td>
                <td className="px-4 py-3">{c.location || muted}</td>
                <td className="px-4 py-3 tabular-nums">{c.built_year ?? muted}</td>
                <td className="px-4 py-3 tabular-nums">{c.amenities.length || muted}</td>
                <td className="px-4 py-3">{usage(c)}</td>
                {canManage ? <td className="px-5 py-2">{actions(c)}</td> : null}
              </ClickableRow>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-[var(--line)] md:hidden">
          {paged.items.map((c) => (
            <ClickableRow key={c.id} as="li" className="px-4 py-3" onActivate={() => openView(c)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {[c.location, c.built_year ? `Built ${c.built_year}` : null].filter(Boolean).join(" · ") || "No city"}
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
              {rows.length ? "Try a different search or filter." : canManage ? "Add an apartment complex to get started." : "No apartment complexes available yet."}
            </p>
          </div>
        ) : null}
        <Pager
          page={paged.page}
          totalPages={paged.totalPages}
          onPage={paged.setPage}
          className="border-t border-[var(--line)] px-4 py-2"
        />
      </section>

      <PopupDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        subtitle={viewing ? `Added ${formatJoined(viewing.created_at)}${viewing.added_by ? ` by ${viewing.added_by}` : ""}` : undefined}
        size="xl"
      >
        {viewing ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {(
                [
                  ["City", viewing.location],
                  ["Developer", viewing.developer],
                  ["Address", viewing.address],
                  ["Built Year", viewing.built_year],
                  ["Age of the Building", buildingAge(viewing.built_year) || null],
                  ["Apartments Per Floor", viewing.apartments_per_floor],
                  ["No of Floors", viewing.number_of_floors],
                  ["COC", viewing.coc],
                  ["Deed", viewing.deed],
                  ["Lifts", viewing.lifts],
                  ["Service Lift", viewing.service_lift],
                  ["Towers / Wings", viewing.towers_wings],
                  [
                    splitTowerNames(viewing.tower_wing_name).length > 1
                      ? "Tower / Wing Names"
                      : "Tower / Wing Name",
                    splitTowerNames(viewing.tower_wing_name).join(" · ") || viewing.tower_wing_name,
                  ],
                  [
                    "Apartment Types",
                    viewing.apartment_types?.length ? viewing.apartment_types.join(" · ") : null,
                  ],
                  ["Swimming Pools", viewing.swimming_pools_count],
                  ["Swimming Pool Floor", viewing.swimming_pools_floor],
                  ["Gym Floor", viewing.gym_floor],
                  ["Generator", viewing.generator],
                  ["Guard Room", viewing.guard_room],
                  ["Common Hall", viewing.common_hall],
                  ["Drivers Washroom", viewing.drivers_washroom],
                  ["Maids Washroom", viewing.maids_washroom],
                  ["Contact (Management / Admin)", viewing.contact_management],
                  ["Contact (Security)", viewing.contact_security],
                  ["Parking", viewing.parking_type],
                  ["Parking Floors", viewing.parking_floors],
                  ["Parking Lift", viewing.parking_lift],
                  ["Maintenance Charges", viewing.maintenance_charges],
                  ["Maintenance", viewing.maintenance_type],
                  ["Maintenance Company", viewing.maintenance_company],
                  ["Google Pin", viewing.google_pin],
                ] as [string, string | number | null][]
              )
                .filter(([, value]) => value != null && value !== "")
                .map(([label, value]) => (
                  <div
                    key={label}
                    className={`min-w-0 ${label === "Address" || label === "Google Pin" || label.startsWith("Contact") ? "col-span-2 sm:col-span-3" : ""}`}
                  >
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
                    <dd className="font-medium break-words">
                      {label === "Google Pin" && typeof value === "string" && /^https?:\/\//i.test(value) ? (
                        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-deep)] hover:underline">
                          {value}
                        </a>
                      ) : (
                        (value ?? "—")
                      )}
                    </dd>
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

            {canManage ? <div className="flex gap-2 sm:justify-end">
              <button type="button" onClick={() => openDelete(viewing)} className={`flex-1 sm:flex-none ${secondaryButtonClass} text-[var(--danger)]`}>
                <Icon name="trash" className="h-4 w-4" />
                Delete
              </button>
              <button type="button" onClick={() => openEdit(viewing)} className={`flex-1 sm:flex-none ${primaryButtonClass}`}>
                <Icon name="edit" className="h-4 w-4" />
                Edit
              </button>
            </div> : null}
          </div>
        ) : null}
      </PopupDialog>

      <PopupDialog open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} busy={pending} size="xl">
        {editing ? (
          <form key={editing.id} onSubmit={(e) => onSave(e, editing.id)} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
            <ComplexFields key={editing.id} values={editing} amenityOptions={amenityOptions} />
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
