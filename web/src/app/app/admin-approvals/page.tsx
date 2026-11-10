import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  SocialQueueActions,
  SocialQueueStatusBadge,
  type SocialQueueStatus,
} from "@/app/app/social-queue/queue-actions";
import { DataChangeActions } from "@/app/app/activity/data-change-actions";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";
import { LinkRow } from "@/components/clickable-row";
import { LiveFilterForm } from "@/components/live-filter-form";
import { Pager, pageFromParam } from "@/components/pager";
import { requireProfile } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

type FeedRow = {
  id: string;
  occurred_at: string;
  category: string;
  action: string;
  actor_name: string | null;
  actor_kind: string | null;
  subject_label: string | null;
  subject_href: string | null;
  summary: string | null;
  detail_lines: string[];
  intent?: string | null;
  queue_id?: string;
  queue_status?: SocialQueueStatus;
  queue_platforms?: string[];
  data_change?: {
    id: string;
    resolved_at: string | null;
    resolved_by: string | null;
    resolution_note: string | null;
    queue_status: SocialQueueStatus | null;
  };
};

type PropertyBits = {
  property_type: string | null;
  opportunity_type: string | null;
  city: string | null;
  created_by_name?: string | null;
};
type Embedded<T> = T | T[] | null;

type SocialRow = {
  id: string;
  ref_no: string;
  approved_action: string | null;
  approved_at: string | null;
  completed_at: string | null;
  requested_platforms: string[] | null;
  created_at: string;
  updated_at: string | null;
  property: Embedded<PropertyBits>;
};

type DataChangeRow = {
  id: string;
  occurred_at: string;
  ref_no: string;
  actor_name: string | null;
  comment: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  property: Embedded<PropertyBits>;
};

function EventRow({
  e,
  as,
  className,
  children,
}: {
  e: FeedRow;
  as: "tr" | "li";
  className: string;
  children: ReactNode;
}) {
  if (e.subject_href && e.subject_label) {
    if (e.subject_href.startsWith("/app/properties/")) {
      return (
        <PropertyRow refNo={e.subject_label} as={as} className={className}>
          {children}
        </PropertyRow>
      );
    }
    return (
      <LinkRow href={e.subject_href} as={as} className={className}>
        {children}
      </LinkRow>
    );
  }
  return as === "li" ? (
    <li className={className}>{children}</li>
  ) : (
    <tr className={className}>{children}</tr>
  );
}

function IntentPill({ intent }: { intent: string }) {
  const tone = ["Publish", "Republish", "New Ad Published"].includes(intent)
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : intent === "Hold"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {intent}
    </span>
  );
}

function TypeBadge({ category }: { category: string }) {
  const social = category === "social";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        social
          ? "bg-[var(--bg-accent)] text-[var(--ink)]"
          : "bg-sky-50 text-sky-800"
      }`}
    >
      {social ? "Social media" : "Data change"}
    </span>
  );
}

function formatWhenParts(iso: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Colombo",
    }),
    time: d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Colombo",
    }),
  };
}

function RequestSummary({ e }: { e: FeedRow }) {
  const meta = e.detail_lines.filter(Boolean);
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge category={e.category} />
        {e.intent ? <IntentPill intent={e.intent} /> : null}
      </div>
      {e.summary ? (
        <p className="text-sm font-medium leading-snug text-[var(--ink)]">{e.summary}</p>
      ) : null}
      {meta.length ? (
        <p className="text-xs text-[var(--muted)]">{meta.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function ReviewCell({ e }: { e: FeedRow }) {
  if (e.queue_id && e.queue_status) {
    return (
      <div className="space-y-2" data-row-ignore>
        <SocialQueueStatusBadge status={e.queue_status} compact />
        <SocialQueueActions
          id={e.queue_id}
          status={e.queue_status}
          mode="activity"
          platforms={e.queue_platforms}
        />
      </div>
    );
  }
  if (e.data_change) {
    return (
      <div data-row-ignore>
        <DataChangeActions
          id={e.data_change.id}
          resolvedAt={e.data_change.resolved_at}
          resolvedBy={e.data_change.resolved_by}
          note={e.data_change.resolution_note}
          queueStatus={e.data_change.queue_status}
        />
      </div>
    );
  }
  return <span className="text-xs text-[var(--muted)]">—</span>;
}

const TABS = [
  { id: "all", label: "All" },
  { id: "social", label: "Social media" },
  { id: "data_change", label: "Data changes" },
] as const;

const DEFAULT_TAB = TABS[0].id;

function socialStatus(row: {
  approved_at: string | null;
  completed_at: string | null;
}): SocialQueueStatus {
  if (row.completed_at) return "published";
  if (row.approved_at) return "approved";
  return "pending";
}

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const sp = await searchParams;
  const requested = one(sp.tab).toLowerCase() || one(sp.category).toLowerCase();
  const tab = TABS.some((t) => t.id === requested) ? requested : DEFAULT_TAB;
  const q = one(sp.q).trim();
  const pendingOnly = one(sp.pending) === "1";
  const showPendingToggle = tab === "all" || tab === "data_change";
  const page = pageFromParam(sp.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const term = q.replace(/[%_,()"\\]/g, " ").trim();
  const like = (cols: string[]) => cols.map((c) => `${c}.ilike.%${term}%`).join(",");
  const supabase = await createClient();

  const pendingSocial = () => {
    let query = supabase
      .from("social_media_queue")
      .select(
        "id, ref_no, approved_action, approved_by, approved_at, requested_platforms, completed_at, created_at, updated_at, property:properties(property_type, opportunity_type, city, created_by_name)",
        { count: "exact" },
      )
      .is("approved_at", null)
      .is("completed_at", null)
      .neq("requested_platforms", "{}");
    if (term) query = query.or(like(["ref_no", "approved_action"]));
    return query.order("updated_at", { ascending: false, nullsFirst: false });
  };

  const dataChanges = () => {
    let query = supabase
      .from("property_status_events")
      .select(
        "id, occurred_at, ref_no, actor_name, comment, resolved_at, resolved_by, resolution_note, property:properties(property_type, opportunity_type, city)",
        { count: "exact" },
      )
      .eq("action", "Data Change")
      .is("archived_at", null);
    if (pendingOnly) query = query.is("resolved_at", null);
    if (term) query = query.or(like(["ref_no", "actor_name", "comment"]));
    return query.order("occurred_at", { ascending: false });
  };

  async function loadTab(): Promise<{
    error: string | null;
    total: number;
    social?: SocialRow[];
    dataChange?: DataChangeRow[];
  }> {
    if (tab === "all") {
      const [s, d] = await Promise.all([pendingSocial().range(0, to), dataChanges().range(0, to)]);
      return {
        error: s.error?.message || d.error?.message || null,
        total: (s.count ?? 0) + (d.count ?? 0),
        social: s.data ?? [],
        dataChange: d.data ?? [],
      };
    }
    if (tab === "social") {
      const s = await pendingSocial().range(from, to);
      return { error: s.error?.message ?? null, total: s.count ?? 0, social: s.data ?? [] };
    }
    const d = await dataChanges().range(from, to);
    return { error: d.error?.message ?? null, total: d.count ?? 0, dataChange: d.data ?? [] };
  }

  const [loaded, pendingHead, openHead] = await Promise.all([
    loadTab(),
    supabase
      .from("social_media_queue")
      .select("id", { count: "exact", head: true })
      .is("approved_at", null)
      .is("completed_at", null)
      .neq("requested_platforms", "{}"),
    supabase
      .from("property_status_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "Data Change")
      .is("archived_at", null)
      .is("resolved_at", null),
  ]);

  if (loaded.error) {
    return <p className="text-[var(--danger)]">{loaded.error}</p>;
  }

  const socialRows = loaded.social ?? [];
  const dataChangeRows = loaded.dataChange ?? [];
  const pendingApprovals = pendingHead.count ?? 0;
  const openDataChanges = openHead.count ?? 0;
  const total = loaded.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const feed: FeedRow[] = [];

  const socialRefs = [...new Set(socialRows.map((r) => r.ref_no))];
  const requesterByRef = new Map<string, string>();
  if (socialRefs.length) {
    const { data: requestEvents } = await supabase
      .from("property_status_events")
      .select("ref_no, actor_name")
      .in("ref_no", socialRefs)
      .not("actor_name", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(500);
    for (const ev of requestEvents ?? []) {
      if (ev.actor_name && !requesterByRef.has(ev.ref_no)) {
        requesterByRef.set(ev.ref_no, ev.actor_name);
      }
    }
  }

  for (const row of socialRows) {
    const property = (Array.isArray(row.property) ? row.property[0] : row.property) as {
      property_type: string | null;
      opportunity_type: string | null;
      city: string | null;
      created_by_name: string | null;
    } | null;
    const platforms = Array.isArray(row.requested_platforms)
      ? (row.requested_platforms as string[])
      : [];
    const occurred = row.completed_at || row.approved_at || row.updated_at || row.created_at;
    const requester = requesterByRef.get(row.ref_no) ?? property?.created_by_name ?? null;
    const propertySummary = [
      property?.property_type,
      property?.opportunity_type,
      property?.city,
    ]
      .filter(Boolean)
      .join(" · ");
    feed.push({
      id: `smq-${row.id}`,
      occurred_at: occurred,
      category: "social",
      action: "awaiting_approval",
      actor_name: requester,
      actor_kind: requester ? "requested" : null,
      subject_label: row.ref_no,
      subject_href: `/app/properties/${row.ref_no}`,
      summary: propertySummary || null,
      detail_lines: [],
      intent: row.approved_action,
      queue_id: row.id,
      queue_status: socialStatus(row),
      queue_platforms: platforms,
    });
  }

  const resolvedRefs = [
    ...new Set(dataChangeRows.filter((r) => r.resolved_at).map((r) => r.ref_no)),
  ];
  const dataChangeQueue = new Map<string, { approved_at: string | null; completed_at: string | null }>();
  if (resolvedRefs.length) {
    const { data: queueRows } = await supabase
      .from("social_media_queue")
      .select("ref_no, approved_at, completed_at")
      .in("ref_no", resolvedRefs);
    for (const row of queueRows ?? []) dataChangeQueue.set(row.ref_no, row);
  }

  for (const row of dataChangeRows) {
    const property = (Array.isArray(row.property) ? row.property[0] : row.property) as {
      property_type: string | null;
      opportunity_type: string | null;
      city: string | null;
    } | null;
    const queueRow = dataChangeQueue.get(row.ref_no);
    const sentToQueue =
      row.resolved_at &&
      queueRow?.approved_at &&
      new Date(queueRow.approved_at).getTime() === new Date(row.resolved_at).getTime();
    feed.push({
      id: `dc-${row.id}`,
      occurred_at: row.occurred_at,
      category: "data_change",
      action: "data_change_request",
      actor_name: row.actor_name,
      actor_kind: row.actor_name ? "requested" : null,
      subject_label: row.ref_no,
      subject_href: `/app/properties/${row.ref_no}`,
      summary: row.comment || "No details given",
      detail_lines: [
        [property?.property_type, property?.opportunity_type, property?.city]
          .filter(Boolean)
          .join(" · "),
      ].filter(Boolean),
      data_change: {
        id: row.id,
        resolved_at: row.resolved_at,
        resolved_by: row.resolved_by,
        resolution_note: row.resolution_note,
        queue_status: sentToQueue && queueRow ? socialStatus(queueRow) : null,
      },
    });
  }

  feed.sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  const visible = tab === "all" ? feed.slice(from, to + 1) : feed;

  function hrefFor(p: number) {
    const params = new URLSearchParams({ tab });
    if (q) params.set("q", q);
    if (pendingOnly) params.set("pending", "1");
    if (p > 1) params.set("page", String(p));
    return `/app/admin-approvals?${params}`;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Admin Approvals</h1>

      <LiveFilterForm
        action="/app/admin-approvals"
        className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input type="hidden" name="tab" value={tab} readOnly />
        <label className="text-sm font-medium sm:min-w-[12rem] sm:flex-1">
          Search
          <input
            name="q"
            defaultValue={one(sp.q)}
            placeholder="Ref, requester, action…"
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          />
        </label>
        {showPendingToggle ? (
          <label className="flex cursor-pointer select-none items-center gap-2.5 self-start rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium sm:self-auto">
            <input
              type="checkbox"
              name="pending"
              value="1"
              defaultChecked={pendingOnly}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-5 w-9 shrink-0 rounded-full bg-[var(--line)] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--sidebar)] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand)]/40"
            />
            Pending only
          </label>
        ) : null}
      </LiveFilterForm>

      <div className="tab-scroll -mx-4 mt-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const params = new URLSearchParams({ tab: t.id });
          if (q) params.set("q", q);
          if (pendingOnly) params.set("pending", "1");
          const href = `/app/admin-approvals?${params}`;
          const active = tab === t.id;
          const badge =
            t.id === "all"
              ? pendingApprovals + openDataChanges
              : t.id === "social"
                ? pendingApprovals
                : openDataChanges;
          return (
            <Link
              key={t.id}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)]"
              }`}
            >
              {t.label}
              {badge ? (
                <span
                  className={`ml-1.5 inline-flex min-w-5 justify-center rounded-full px-1.5 text-[10px] leading-4 ${
                    active ? "bg-white text-[var(--brand)]" : "bg-[var(--brand)] text-white"
                  }`}
                  title={`${badge} to do`}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">
        {total.toLocaleString()} {total === 1 ? "item" : "items"} · page {page} of {totalPages}
      </p>

      <ul className="mt-4 space-y-3 md:hidden">
        {visible.map((e) => {
          const when = formatWhenParts(e.occurred_at);
          return (
            <EventRow
              key={e.id}
              e={e}
              as="li"
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <RequestSummary e={e} />
                {e.subject_label ? (
                  <div className="shrink-0">
                    {e.subject_href?.startsWith("/app/properties/") ? (
                      <PropertyLink refNo={e.subject_label}>{e.subject_label}</PropertyLink>
                    ) : (
                      <span className="text-sm font-semibold text-[var(--brand-deep)]">
                        {e.subject_label}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <span>{e.actor_name || "Unknown"}</span>
                <span aria-hidden>·</span>
                <span>
                  {when.date}
                  {when.time ? ` · ${when.time}` : ""}
                </span>
              </div>
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <ReviewCell e={e} />
              </div>
            </EventRow>
          );
        })}
        {!visible.length ? (
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            No approvals waiting.
          </li>
        ) : null}
      </ul>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)] md:block">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/60 text-[var(--ink)]">
            <tr>
              <th className="w-28 px-5 py-3.5 text-xs font-bold uppercase tracking-wide">When</th>
              <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide">Request</th>
              <th className="w-32 px-5 py-3.5 text-xs font-bold uppercase tracking-wide">By</th>
              <th className="w-28 px-5 py-3.5 text-xs font-bold uppercase tracking-wide">Property</th>
              <th className="min-w-56 px-5 py-3.5 text-xs font-bold uppercase tracking-wide">
                Review
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const when = formatWhenParts(e.occurred_at);
              return (
                <EventRow
                  key={e.id}
                  e={e}
                  as="tr"
                  className="border-b border-[var(--line)] align-top transition-colors last:border-0 hover:bg-[var(--bg-accent)]/35"
                >
                  <td className="whitespace-nowrap px-5 py-4">
                    <p className="text-sm font-medium text-[var(--ink)]">{when.date}</p>
                    {when.time ? (
                      <p className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">{when.time}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <RequestSummary e={e} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-[var(--ink)]">{e.actor_name || "—"}</p>
                  </td>
                  <td className="px-5 py-4">
                    {e.subject_href && e.subject_label ? (
                      e.subject_href.startsWith("/app/properties/") ? (
                        <PropertyLink refNo={e.subject_label}>{e.subject_label}</PropertyLink>
                      ) : (
                        <Link
                          href={e.subject_href}
                          className="font-semibold text-[var(--brand-deep)] hover:underline"
                        >
                          {e.subject_label}
                        </Link>
                      )
                    ) : (
                      e.subject_label || "—"
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <ReviewCell e={e} />
                  </td>
                </EventRow>
              );
            })}
            {!visible.length ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-[var(--muted)]">
                  No approvals waiting.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={totalPages} hrefFor={hrefFor} className="mt-4" />
    </div>
  );
}
