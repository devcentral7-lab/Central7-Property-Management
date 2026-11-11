import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { IkmanImportForm } from "@/app/app/ikman-republish/import-form";
import {
  ForceReaskButton,
  OwnerDecideButtons,
  ReadyQueueActions,
} from "@/app/app/ikman-republish/item-actions";
import {
  listIkmanItems,
  loadIkmanHistory,
  type IkmanAuditEvent,
  type IkmanBatchRow,
  type IkmanListItem,
} from "@/app/app/ikman-republish/actions";
import { LiveFilterForm } from "@/components/live-filter-form";
import { Pager, pageFromParam } from "@/components/pager";
import { requireProfile } from "@/lib/auth";
import {
  IKMAN_ITEM_STATUSES,
  ikmanStatusLabel,
  type IkmanItemStatus,
} from "@/lib/ikman-republish";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const TABS = [
  { id: "import", label: "Import" },
  { id: "pending", label: "Owner pending" },
  { id: "ready", label: "Ready to republish" },
  { id: "suppressed", label: "Suppressed" },
  { id: "history", label: "History" },
] as const;

const HISTORY_PAGE_SIZE = 50;

function auditActionLabel(action: string) {
  switch (action) {
    case "ikman_republish_batch":
      return "Import batch";
    case "ikman_republish_approved":
      return "Owner approved";
    case "ikman_republish_declined":
      return "Owner declined";
    case "ikman_republish_completed":
      return "Marked republished";
    case "ikman_republish_force_reask":
      return "Force re-ask";
    default:
      return action.replace(/_/g, " ");
  }
}

function formatDetailLines(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details as Record<string, unknown>)
    .filter(([k, v]) => k !== "refs" && v != null && v !== "")
    .map(([k, v]) => {
      const value = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}: ${value}`;
    })
    .slice(0, 6);
}

function normalizeRef(raw: string) {
  const m = raw.trim().match(/^C7-(\d+)$/i);
  return m ? `C7-${m[1]}` : null;
}

function refsFromEvent(e: IkmanAuditEvent): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const ref = normalizeRef(raw);
    if (!ref || seen.has(ref)) return;
    seen.add(ref);
    out.push(ref);
  };

  const fromDetails =
    e.details && typeof e.details === "object" && !Array.isArray(e.details)
      ? (e.details as { refs?: unknown }).refs
      : null;
  if (Array.isArray(fromDetails)) {
    for (const r of fromDetails) add(String(r));
  }
  if (e.subject_label) add(e.subject_label);
  for (const m of `${e.summary ?? ""}`.matchAll(/\bC7-\d+\b/gi)) add(m[0]);
  return out;
}

function shortId(id: string | null) {
  if (!id) return "—";
  return id.slice(0, 8);
}

export default async function IkmanRepublishPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const sp = await searchParams;
  const requested = one(sp.tab).toLowerCase();
  const tab = TABS.some((t) => t.id === requested) ? requested : "import";
  const historyQ = one(sp.q).trim();
  const historyStatus = one(sp.status).trim();
  const historyPage = pageFromParam(sp.page);
  const eventsPage = pageFromParam(sp.eventsPage);

  const [pendingAll, readyAll, suppressedAll, history] = await Promise.all([
    listIkmanItems("pending_owner"),
    listIkmanItems("approved_by_owner"),
    listIkmanItems("declined_by_owner"),
    tab === "history"
      ? loadIkmanHistory({
          q: historyQ,
          status: historyStatus,
          page: historyPage,
          eventsPage,
          pageSize: HISTORY_PAGE_SIZE,
        })
      : Promise.resolve(null),
  ]);

  const badge = {
    import: null as number | null,
    pending: pendingAll.length,
    ready: readyAll.length,
    suppressed: suppressedAll.length,
    history: history
      ? Object.values(history.statusCounts).reduce((a, b) => a + b, 0)
      : null,
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Ikman Republish</h1>

      <div className="tab-scroll -mx-4 mt-5 px-4 sm:mx-0 sm:mt-6 sm:px-0">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = badge[t.id];
          return (
            <Link
              key={t.id}
              href={`/app/ikman-republish?tab=${t.id}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)]"
              }`}
            >
              {t.label}
              {count ? (
                <span
                  className={`ml-1.5 inline-flex min-w-5 justify-center rounded-full px-1.5 text-[10px] leading-4 ${
                    active ? "bg-white text-[var(--brand)]" : "bg-[var(--brand)] text-white"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "import" ? <IkmanImportForm /> : null}

        {tab === "pending" ? (
          <ItemTable
            rows={pendingAll}
            empty="No owner decisions waiting."
            showOwner
            action={(row) => <OwnerDecideButtons id={row.id} />}
          />
        ) : null}

        {tab === "ready" ? (
          readyAll.length ? (
            <div className="space-y-4">
              <ReadyQueueActions items={readyAll.map((r) => ({ id: r.id, ref_no: r.ref_no }))} />
              <ItemTable
                rows={readyAll}
                empty=""
                showOwner
                action={(row) => (
                  <p className="text-xs text-[var(--muted)]">
                    Approved
                    {row.owner_decided_at
                      ? ` · ${new Date(row.owner_decided_at).toLocaleString()}`
                      : ""}
                    {row.owner_note ? ` · ${row.owner_note}` : ""}
                  </p>
                )}
              />
            </div>
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Nothing ready to republish on Ikman.
            </p>
          )
        ) : null}

        {tab === "suppressed" ? (
          <ItemTable
            rows={suppressedAll}
            empty="No declined / suppressed listings."
            showOwner
            action={(row) => <ForceReaskButton id={row.id} />}
          />
        ) : null}

        {tab === "history" && history ? (
          <HistoryPanel
            items={history.items}
            batches={history.batches}
            events={history.events}
            total={history.total}
            eventsTotal={history.eventsTotal}
            statusCounts={history.statusCounts}
            q={historyQ}
            status={historyStatus}
            page={historyPage}
            eventsPage={eventsPage}
          />
        ) : null}
      </div>
    </div>
  );
}

function HistoryPanel({
  items,
  batches,
  events,
  total,
  eventsTotal,
  statusCounts,
  q,
  status,
  page,
  eventsPage,
}: {
  items: IkmanListItem[];
  batches: IkmanBatchRow[];
  events: IkmanAuditEvent[];
  total: number;
  eventsTotal: number;
  statusCounts: Record<IkmanItemStatus, number>;
  q: string;
  status: string;
  page: number;
  eventsPage: number;
}) {
  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const itemsPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const eventsPages = Math.max(1, Math.ceil(eventsTotal / HISTORY_PAGE_SIZE));

  function historyHref(opts: {
    page?: number;
    eventsPage?: number;
    status?: string;
    q?: string;
  }) {
    const params = new URLSearchParams({ tab: "history" });
    const nextQ = opts.q ?? q;
    const nextStatus = opts.status ?? status;
    const nextPage = opts.page ?? page;
    const nextEvents = opts.eventsPage ?? eventsPage;
    if (nextQ) params.set("q", nextQ);
    if (nextStatus) params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextEvents > 1) params.set("eventsPage", String(nextEvents));
    return `/app/ikman-republish?${params}`;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <StatChip label="All records" value={totalAll} active={!status} href={historyHref({ status: "", page: 1 })} />
        {IKMAN_ITEM_STATUSES.map((s) => (
          <StatChip
            key={s}
            label={ikmanStatusLabel(s)}
            value={statusCounts[s] ?? 0}
            active={status === s}
            href={historyHref({ status: s, page: 1 })}
          />
        ))}
      </div>

      <LiveFilterForm action="/app/ikman-republish" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="history" />
        <label className="block min-w-[12rem] flex-1 text-xs font-semibold text-[var(--muted)]">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Ref, owner, note, admin…"
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)]"
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Status
          <select
            name="status"
            defaultValue={status}
            data-default-value=""
            className="mt-1 block rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)]"
          >
            <option value="">All statuses</option>
            {IKMAN_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ikmanStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </LiveFilterForm>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">
          Action log
          <span className="ml-2 font-normal text-[var(--muted)]">({eventsTotal})</span>
        </h2>
        {events.length ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">When</th>
                    <th className="px-4 py-3 font-bold">Action</th>
                    <th className="px-4 py-3 font-bold">User</th>
                    <th className="px-4 py-3 font-bold">Ref</th>
                    <th className="px-4 py-3 font-bold">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const details = formatDetailLines(e.details);
                    const refs = refsFromEvent(e);
                    return (
                      <tr key={String(e.id)} className="border-b border-[var(--line)] align-top last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                          {new Date(e.occurred_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          {auditActionLabel(e.action)}
                        </td>
                        <td className="px-4 py-3">{e.actor_name || "—"}</td>
                        <td className="px-4 py-3">
                          {refs.length ? (
                            <div className="flex flex-col gap-0.5">
                              {refs.map((ref) => (
                                <PropertyLink key={ref} refNo={ref}>
                                  {ref}
                                </PropertyLink>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--muted)]">
                          <p>{e.summary || "—"}</p>
                          {details.length ? (
                            <ul className="mt-1 space-y-0.5">
                              {details.map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={eventsPage}
              totalPages={eventsPages}
              hrefFor={(p) => historyHref({ eventsPage: p })}
            />
          </>
        ) : (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No Ikman actions recorded yet.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">
          Import batches
          <span className="ml-2 font-normal text-[var(--muted)]">({batches.length})</span>
        </h2>
        {batches.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
                <tr>
                  <th className="px-4 py-3 font-bold">When</th>
                  <th className="px-4 py-3 font-bold">Admin</th>
                  <th className="px-4 py-3 font-bold">Parsed</th>
                  <th className="px-4 py-3 font-bold">Sent</th>
                  <th className="px-4 py-3 font-bold">Skipped</th>
                  <th className="px-4 py-3 font-bold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-[var(--line)] align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{b.created_by_name || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{b.parsed_ref_count}</td>
                    <td className="px-4 py-3 tabular-nums">{b.enqueued_count}</td>
                    <td className="px-4 py-3 tabular-nums">{b.skipped_count}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {b.notes || <span title={b.id}>#{shortId(b.id)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No import batches yet.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">
          All requests
          <span className="ml-2 font-normal text-[var(--muted)]">({total})</span>
        </h2>
        {items.length ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Ref No</th>
                    <th className="px-4 py-3 font-bold">Owner</th>
                    <th className="px-4 py-3 font-bold">Listing</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Created</th>
                    <th className="px-4 py-3 font-bold">Decision</th>
                    <th className="px-4 py-3 font-bold">Completed</th>
                    <th className="px-4 py-3 font-bold">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--line)] align-top last:border-0">
                      <td className="px-4 py-3">
                        <PropertyLink refNo={row.ref_no}>{row.ref_no}</PropertyLink>
                      </td>
                      <td className="px-4 py-3">{row.owner_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {[row.property_type, row.opportunity_type, row.city]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">
                        {ikmanStatusLabel(row.status)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {row.owner_decided_at
                          ? new Date(row.owner_decided_at).toLocaleString()
                          : "—"}
                        {row.owner_note ? (
                          <p className="mt-0.5 text-[var(--ink)]">{row.owner_note}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {row.admin_completed_at
                          ? new Date(row.admin_completed_at).toLocaleString()
                          : "—"}
                        {row.admin_completed_by_name ? (
                          <p className="mt-0.5">{row.admin_completed_by_name}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]" title={row.batch_id ?? undefined}>
                        {shortId(row.batch_id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={itemsPages} hrefFor={(p) => historyHref({ page: p })} />
          </>
        ) : (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No matching requests.
          </p>
        )}
      </section>
    </div>
  );
}

function StatChip({
  label,
  value,
  active,
  href,
}: {
  label: string;
  value: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
          : "border-[var(--line)] bg-[var(--card)] hover:bg-[var(--bg-accent)]"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${active ? "text-white/80" : "text-[var(--muted)]"}`}>
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

function ItemTable({
  rows,
  empty,
  showOwner,
  action,
}: {
  rows: Awaited<ReturnType<typeof listIkmanItems>>;
  empty: string;
  showOwner?: boolean;
  action?: (row: Awaited<ReturnType<typeof listIkmanItems>>[number]) => ReactNode;
}) {
  if (!rows.length && empty) {
    return (
      <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        {empty}
      </p>
    );
  }
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
          <tr>
            <th className="px-4 py-3 font-bold">Ref No</th>
            {showOwner ? <th className="px-4 py-3 font-bold">Owner</th> : null}
            <th className="px-4 py-3 font-bold">Listing</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold">When</th>
            <th className="px-4 py-3 font-bold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--line)] align-top last:border-0">
              <td className="px-4 py-3">
                <PropertyLink refNo={row.ref_no}>{row.ref_no}</PropertyLink>
              </td>
              {showOwner ? <td className="px-4 py-3">{row.owner_name || "—"}</td> : null}
              <td className="px-4 py-3 text-xs text-[var(--muted)]">
                {[row.property_type, row.opportunity_type, row.city].filter(Boolean).join(" · ") ||
                  "—"}
              </td>
              <td className="px-4 py-3 text-xs font-semibold">{ikmanStatusLabel(row.status)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                {new Date(row.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">{action?.(row) ?? null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
