"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { updatePropertyStatus } from "@/app/app/actions";
import { DeletePropertyButton } from "@/app/app/properties/[ref]/delete-property-button";
import { PropertyForm } from "@/app/app/properties/new/property-form";
import {
  getPropertyModalData,
  type PropertyModalData,
} from "@/app/app/properties/modal-actions";
import { PropertyPhotosPanel } from "@/app/app/properties/property-photos-panel";

type Mode = "view" | "edit";

type ModalState = {
  open: boolean;
  mode: Mode;
  refNo: string | null;
  loading: boolean;
  error: string | null;
  data: PropertyModalData | null;
};

type Ctx = {
  openView: (refNo: string) => void;
  openEdit: (refNo: string) => void;
  close: () => void;
};

const PropertyModalContext = createContext<Ctx | null>(null);

export function usePropertyModal() {
  const ctx = useContext(PropertyModalContext);
  if (!ctx) {
    throw new Error("usePropertyModal must be used within PropertyModalProvider");
  }
  return ctx;
}

function ModalShell({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-start sm:overflow-y-auto sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg)] shadow-2xl sm:my-4 sm:h-auto sm:rounded-2xl sm:border sm:border-[var(--line)] ${
          wide ? "sm:max-w-6xl" : "sm:max-w-5xl"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3">
          <p className="text-sm font-semibold text-[var(--muted)]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)] sm:px-3 sm:py-1.5"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[min(85vh,900px)] sm:flex-none sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function ViewBody({
  data,
  onEdit,
}: {
  data: PropertyModalData;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_0.75fr]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-[var(--brand-deep)] sm:text-3xl">
              {data.refNo}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{data.headline}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.canEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
              >
                Edit listing
              </button>
            ) : null}
            {data.canDelete ? (
              <DeletePropertyButton refNo={data.refNo} />
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 lg:grid-cols-3">
          {data.fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {f.label}
              </dt>
              <dd className="mt-0.5 break-words text-sm">{f.value}</dd>
            </div>
          ))}
        </dl>

        {data.comments ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="font-display text-base font-semibold">Comments</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {data.comments}
            </p>
          </div>
        ) : null}

        {data.internalComments ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)]/60 p-4">
            <h2 className="font-display text-base font-semibold">
              Internal comments
              <span className="ml-2 align-middle text-xs font-normal text-[var(--muted)]">
                Staff only
              </span>
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {data.internalComments}
            </p>
          </div>
        ) : null}

        <PropertyPhotosPanel refNo={data.refNo} canEdit={data.canEdit} />
      </div>

      <aside className="space-y-4">
        {data.canChangeStatus ? (
          <form
            action={updatePropertyStatus}
            className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
          >
            <h2 className="font-display text-base font-semibold">
              Update status
            </h2>
            <input type="hidden" name="ref_no" value={data.refNo} />
            <select
              name="action"
              required
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              defaultValue="Data Change"
            >
              {data.statusChangeOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <textarea
              name="comment"
              rows={2}
              placeholder="Comment"
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-[var(--brand)] py-2 text-sm font-semibold text-white"
            >
              Submit
            </button>
          </form>
        ) : null}

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-display text-base font-semibold">
            Recent activity
          </h2>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
            {data.events.map((e) => (
              <li
                key={e.id}
                className="border-b border-[var(--line)] pb-2 text-sm last:border-0"
              >
                <p className="font-semibold">{e.action}</p>
                <p className="text-xs text-[var(--muted)]">
                  {e.actor_name || "—"}
                  {e.assigned_to ? ` → ${e.assigned_to}` : ""}
                </p>
                {e.comment ? (
                  <p className="mt-1 text-[var(--muted)]">{e.comment}</p>
                ) : null}
              </li>
            ))}
            {!data.events.length ? (
              <li className="text-sm text-[var(--muted)]">No events yet.</li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function PropertyModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState>({
    open: false,
    mode: "view",
    refNo: null,
    loading: false,
    error: null,
    data: null,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback((refNo: string, mode: Mode) => {
    const normalized = refNo.toUpperCase();
    setState({
      open: true,
      mode,
      refNo: normalized,
      loading: true,
      error: null,
      data: null,
    });
    void getPropertyModalData(normalized).then((result) => {
      setState((prev) => {
        if (prev.refNo !== normalized || !prev.open) return prev;
        if (!result.ok) {
          return {
            ...prev,
            loading: false,
            error: result.error,
            data: null,
          };
        }
        return {
          ...prev,
          loading: false,
          error: null,
          data: result.data,
          mode: mode === "edit" && result.data.canEdit ? "edit" : "view",
        };
      });
    });
  }, []);

  const openView = useCallback(
    (refNo: string) => load(refNo, "view"),
    [load],
  );
  const openEdit = useCallback(
    (refNo: string) => load(refNo, "edit"),
    [load],
  );
  const close = useCallback(() => {
    setState({
      open: false,
      mode: "view",
      refNo: null,
      loading: false,
      error: null,
      data: null,
    });
  }, []);

  const dialog =
    state.open && mounted ? (
      <ModalShell
        title={state.mode === "edit" ? "Edit listing" : "Property details"}
        wide={state.mode === "edit"}
        onClose={close}
      >
        {state.loading ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            Loading {state.refNo}…
          </p>
        ) : null}
        {state.error ? (
          <p className="py-10 text-center text-sm text-[var(--danger)]">
            {state.error}
          </p>
        ) : null}
        {state.data && state.mode === "view" ? (
          <ViewBody
            data={state.data}
            onEdit={() => setState((prev) => ({ ...prev, mode: "edit" }))}
          />
        ) : null}
        {state.data && state.mode === "edit" ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h1 className="font-display text-2xl font-semibold">
                Edit {state.data.refNo}
              </h1>
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, mode: "view" }))
                }
                className="text-sm font-semibold text-[var(--brand-deep)] hover:underline"
              >
                ← Back to details
              </button>
            </div>
            <PropertyForm
              mode="edit"
              refNo={state.data.refNo}
              complexes={state.data.complexes}
              options={state.data.options}
              initialDoNotPublish={state.data.initialDoNotPublish}
              initialAmenities={state.data.initialAmenities}
              initialValues={state.data.initialValues}
            />
          </div>
        ) : null}
      </ModalShell>
    ) : null;

  return (
    <PropertyModalContext.Provider value={{ openView, openEdit, close }}>
      {children}
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </PropertyModalContext.Provider>
  );
}

export function PropertyLink({
  refNo,
  children,
  className,
}: {
  refNo: string;
  children: ReactNode;
  className?: string;
}) {
  const { openView } = usePropertyModal();
  const href = `/app/properties/${encodeURIComponent(refNo)}`;

  return (
    <a
      href={href}
      data-nav-skip
      className={
        className ??
        "font-semibold text-[var(--brand-deep)] hover:underline"
      }
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        openView(refNo);
      }}
    >
      {children}
    </a>
  );
}
