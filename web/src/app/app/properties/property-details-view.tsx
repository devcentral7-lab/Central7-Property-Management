import type { ReactNode } from "react";
import { MapLinkButtons } from "@/components/map-link-buttons";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppLink } from "@/components/whatsapp-link";
import type {
  DetailSection,
  DetailSectionId,
  FactIcon,
  PropertyDetailsModel,
} from "@/lib/property-details";

type IconName = FactIcon | DetailSectionId | "amenities" | "pin";

const PATHS: Record<IconName, string> = {
  area: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  land: "M3 19 9 8l4 6 3-4 5 9Z",
  bed: "M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V7h5v2",
  bath: "M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM6 12V6a2 2 0 0 1 4 0",
  floors: "m12 3 9 5-9 5-9-5ZM3 13l9 5 9-5",
  parking: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM10 16V8h3a2.5 2.5 0 0 1 0 5h-3",
  property: "M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6",
  location: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  pin: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  pricing: "M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01",
  contact: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  record: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  amenities: "m5 12 4.5 4.5L19 7",
};

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--card)] px-2.5 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  className = "",
  children,
}: {
  icon: IconName;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] ${className}`}
    >
      <h2 className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)]/60 px-4 py-2.5 font-display text-sm font-semibold">
        <span className="text-[var(--brand)]">
          <Icon name={icon} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldRows({ section }: { section: DetailSection }) {
  return (
    <dl className="divide-y divide-[var(--line)] px-4">
      {section.fields.map((f) => (
        <div key={f.label} className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-2.5 py-2">
          <dt className="text-xs font-medium text-[var(--muted)]">{f.label}</dt>
          <dd
            className={`min-w-0 break-words text-sm font-medium ${f.phone ? "flex items-center gap-1" : ""}`}
          >
            {f.mapLink ? (
              <MapLinkButtons url={f.value} />
            ) : f.href ? (
              <a
                href={f.href}
                target={f.href.startsWith("http") ? "_blank" : undefined}
                rel={f.href.startsWith("http") ? "noreferrer" : undefined}
                data-nav-skip
                className="min-w-0 text-[var(--brand-deep)] hover:underline"
              >
                {f.value}
              </a>
            ) : (
              f.value
            )}
            {f.phone ? <WhatsAppLink phone={f.value} className="-my-1" /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PropertyDetailsView({
  model,
  actions,
  children,
}: {
  model: PropertyDetailsModel;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const rent = /rent|lease/i.test(model.opportunity || "");
  const byId = new Map(model.sections.map((s) => [s.id, s]));
  const half = (["property", "location", "pricing", "contact"] as const)
    .map((id) => byId.get(id))
    .filter((s): s is DetailSection => Boolean(s));
  const record = byId.get("record");

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-[var(--brand-deep)] sm:text-3xl">
            {model.refNo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {model.status ? (
              <Tag>
                <StatusBadge status={model.status} />
              </Tag>
            ) : null}
            {model.propertyType ? <Tag>{model.propertyType}</Tag> : null}
            {model.opportunity ? <Tag>{rent ? "For rent" : "For sale"}</Tag> : null}
            {model.city ? (
              <Tag>
                <Icon name="pin" className="h-3 w-3 text-[var(--muted)]" />
                {model.city}
              </Tag>
            ) : null}
            {model.doNotPublish ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Do not publish
              </span>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      {model.price || model.facts.length ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          {model.price ? (
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {rent ? "Monthly rent" : "Asking price"}
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--ink)]">
                  {model.price}
                </p>
              </div>
              {model.priceNote ? (
                <p className="pb-1 text-sm text-[var(--muted)]">{model.priceNote}</p>
              ) : null}
            </div>
          ) : null}
          {model.facts.length ? (
            <ul
              className={`flex flex-wrap gap-2 ${model.price ? "mt-4 border-t border-[var(--line)] pt-4" : ""}`}
            >
              {model.facts.map((f) => (
                <li
                  key={f.label}
                  className="flex min-w-[5.5rem] flex-1 flex-col items-center rounded-lg bg-[var(--bg)]/70 px-2 py-2.5 text-center"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]">
                    <Icon name={f.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-1.5 text-base font-semibold leading-none tabular-nums">
                    {f.value}
                  </span>
                  <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {half.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {half.map((s) => (
            <SectionCard key={s.id} icon={s.id} title={s.title}>
              <FieldRows section={s} />
            </SectionCard>
          ))}
        </div>
      ) : null}

      {model.amenities.length ? (
        <SectionCard icon="amenities" title="Amenities">
          <ul className="flex flex-wrap gap-2 p-4">
            {model.amenities.map((a) => (
              <li
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg)] px-3 py-1 text-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {children}

      {record ? (
        <SectionCard icon="record" title={record.title}>
          <FieldRows section={record} />
        </SectionCard>
      ) : null}
    </div>
  );
}

export function NotesCards({
  comments,
  internalComments,
}: {
  comments: string | null;
  internalComments: string | null;
}) {
  if (!comments && !internalComments) return null;
  return (
    <div className={`grid gap-4 ${comments && internalComments ? "md:grid-cols-2" : ""}`}>
      {comments ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-display text-sm font-semibold">Comments</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{comments}</p>
        </section>
      ) : null}
      {internalComments ? (
        <section className="rounded-xl border border-dashed border-[var(--muted)]/40 bg-[var(--bg)]/60 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            Internal Comments
            <span className="rounded bg-[var(--sidebar)] px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-white">
              Staff only
            </span>
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{internalComments}</p>
        </section>
      ) : null}
    </div>
  );
}
