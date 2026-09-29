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
import { ClickableRow } from "@/components/clickable-row";
import { DeletePropertyButton } from "@/app/app/properties/[ref]/delete-property-button";
import { ActivityButton } from "@/app/app/properties/activity-button";
import { ExportPdfButton } from "@/app/app/properties/export-pdf-button";
import { UpdateStatusButton } from "@/app/app/properties/update-status-button";
import {
  NotesCards,
  PropertyDetailsView,
} from "@/app/app/properties/property-details-view";
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
  onRefresh,
}: {
  data: PropertyModalData;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  return (
    <PropertyDetailsView
      model={data.details}
      actions={
        <>
          {data.canChangeStatus ? (
            <UpdateStatusButton
              refNo={data.refNo}
              options={data.statusChangeOptions}
              onDone={onRefresh}
            />
          ) : null}
          <ActivityButton refNo={data.refNo} events={data.events} />
          <ExportPdfButton refNo={data.refNo} />
          {data.canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
            >
              Edit listing
            </button>
          ) : null}
          {data.canDelete ? <DeletePropertyButton refNo={data.refNo} /> : null}
        </>
      }
    >
      <NotesCards comments={data.comments} internalComments={data.internalComments} />
      <PropertyPhotosPanel refNo={data.refNo} canEdit={data.canEdit} />
    </PropertyDetailsView>
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

  const refresh = useCallback(() => {
    const refNo = state.refNo;
    if (!refNo) return;
    void getPropertyModalData(refNo).then((result) => {
      if (!result.ok) return;
      setState((prev) =>
        prev.open && prev.refNo === refNo ? { ...prev, data: result.data } : prev,
      );
    });
  }, [state.refNo]);

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
            onRefresh={refresh}
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

/** Table row / card that opens the property popup when clicked anywhere. */
export function PropertyRow({
  refNo,
  as,
  className,
  children,
}: {
  refNo: string;
  as?: "tr" | "li" | "div";
  className?: string;
  children: ReactNode;
}) {
  const { openView } = usePropertyModal();
  return (
    <ClickableRow
      as={as}
      className={className}
      onActivate={(newTab) => {
        if (newTab) {
          window.open(`/app/properties/${encodeURIComponent(refNo)}`, "_blank", "noopener");
        } else {
          openView(refNo);
        }
      }}
    >
      {children}
    </ClickableRow>
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
