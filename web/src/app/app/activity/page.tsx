import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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
};

type AuditRow = {
  id: string | number;
  occurred_at: string;
  category: string;
  action: string;
  actor_name: string | null;
  actor_kind: string | null;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  summary: string | null;
  details: unknown;
  ip: string | null;
};

type WorkflowRow = {
  id: string | number;
  occurred_at: string;
  ref_no: string;
  actor_name: string | null;
  action: string;
  comment: string | null;
  requested_platforms: string[] | null;
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

function humanize(action: string) {
  const text = action.replace(/_/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "queue", label: "Social media queue" },
  { id: "auth", label: "Logins" },
  { id: "property", label: "Properties" },
  { id: "staff", label: "Staff" },
  { id: "partner", label: "Partners" },
  { id: "settings", label: "Settings" },
  { id: "finance", label: "Finance" },
  { id: "workflow", label: "Workflow" },
] as const;

const DEFAULT_CATEGORY = CATEGORIES[0].id;

const APPROVAL_REDIRECTS = new Set(["social", "data_change"]);

function categoryLabel(category: string) {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

function formatDetails(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }
  return Object.entries(details as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const value = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}: ${value}`;
    })
    .slice(0, 8);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const sp = await searchParams;
  const requested = one(sp.category).toLowerCase();
  if (APPROVAL_REDIRECTS.has(requested)) {
    const params = new URLSearchParams({ tab: requested });
    const q = one(sp.q).trim();
    if (q) params.set("q", q);
    if (one(sp.pending) === "1") params.set("pending", "1");
    redirect(`/app/admin-approvals?${params}`);
  }

  const category = CATEGORIES.some((c) => c.id === requested)
    ? requested
    : DEFAULT_CATEGORY;
  const q = one(sp.q).trim();
  const page = pageFromParam(sp.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const term = q.replace(/[%_,()"\\]/g, " ").trim();
  const like = (cols: string[]) => cols.map((c) => `${c}.ilike.%${term}%`).join(",");
  const supabase = await createClient();

  async function loadCategory(): Promise<{
    error: string | null;
    total: number;
    audit?: AuditRow[];
    workflow?: WorkflowRow[];
  }> {
    if (category === "workflow") {
      let query = supabase
        .from("property_status_events")
        .select("id, occurred_at, ref_no, actor_name, action, comment, requested_platforms", {
          count: "exact",
        })
        .is("archived_at", null);
      if (term) query = query.or(like(["ref_no", "actor_name", "action", "comment"]));
      const w = await query.order("occurred_at", { ascending: false }).range(from, to);
      return { error: w.error?.message ?? null, total: w.count ?? 0, workflow: w.data ?? [] };
    }

    let query = supabase
      .from("audit_log")
      .select(
        "id, occurred_at, category, action, actor_name, actor_kind, subject_type, subject_id, subject_label, summary, details, ip",
        { count: "exact" },
      );
    if (category !== "all") query = query.eq("category", category);
    if (term) query = query.or(like(["actor_name", "subject_label", "summary", "action"]));
    const a = await query.order("occurred_at", { ascending: false }).range(from, to);
    return { error: a.error?.message ?? null, total: a.count ?? 0, audit: a.data ?? [] };
  }

  const loaded = await loadCategory();
  if (loaded.error) {
    return <p className="text-[var(--danger)]">{loaded.error}</p>;
  }

  const auditRows = loaded.audit ?? [];
  const workflowRows = loaded.workflow ?? [];
  const total = loaded.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const feed: FeedRow[] = [];

  for (const row of auditRows) {
    const details = formatDetails(row.details);
    if (row.ip) details.unshift(`ip: ${row.ip}`);
    feed.push({
      id: `audit-${row.id}`,
      occurred_at: row.occurred_at,
      category: row.category,
      action: row.action,
      actor_name: row.actor_name,
      actor_kind: row.actor_kind,
      subject_label: row.subject_label,
      subject_href:
        row.subject_type === "property" && row.subject_label
          ? `/app/properties/${row.subject_label}`
          : row.subject_type === "invoice" && row.subject_id
            ? `/app/finance/invoices/${row.subject_id}`
            : null,
      summary: row.summary,
      detail_lines: details,
    });
  }

  for (const row of workflowRows) {
    const platforms = Array.isArray(row.requested_platforms)
      ? row.requested_platforms.join(", ")
      : "";
    const details = [
      row.comment ? `comment: ${row.comment}` : null,
      platforms ? `platforms: ${platforms}` : null,
    ].filter(Boolean) as string[];

    feed.push({
      id: `wf-${row.id}`,
      occurred_at: row.occurred_at,
      category: "workflow",
      action: String(row.action),
      actor_name: row.actor_name,
      actor_kind: "staff",
      subject_label: row.ref_no,
      subject_href: `/app/properties/${row.ref_no}`,
      summary: `${row.action} on ${row.ref_no}`,
      detail_lines: details,
    });
  }

  function hrefFor(p: number) {
    const params = new URLSearchParams({ category });
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    return `/app/activity?${params}`;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Activity Log</h1>
        <Link
          href="/app/admin-approvals"
          className="shrink-0 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-accent)]"
        >
          Admin Approvals
        </Link>
      </div>

      <LiveFilterForm
        action="/app/activity"
        className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="text-sm font-medium">
          Category
          <select
            name="category"
            defaultValue={category}
            data-default-value={DEFAULT_CATEGORY}
            className="mt-1 block w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm sm:w-auto"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:min-w-[12rem] sm:flex-1">
          Search
          <input
            name="q"
            defaultValue={one(sp.q)}
            placeholder="Actor, ref, action…"
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          />
        </label>
      </LiveFilterForm>

      <div className="tab-scroll -mx-4 mt-4 px-4 sm:mx-0 sm:px-0">
        {CATEGORIES.map((c) => {
          const href = `/app/activity?category=${c.id}${
            q ? `&q=${encodeURIComponent(q)}` : ""
          }`;
          const active = category === c.id;
          return (
            <Link
              key={c.id}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)]"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">
        {total.toLocaleString()} {total === 1 ? "event" : "events"} (latest first) · page {page} of{" "}
        {totalPages} · {PAGE_SIZE} per page
      </p>

      <ul className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] md:hidden">
        {feed.map((e) => (
          <EventRow key={e.id} e={e} as="li" className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
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
                  <p className="font-semibold">{e.subject_label || "—"}</p>
                )}
                <p className="mt-0.5 text-sm">
                  {e.actor_name || "—"}
                  {e.actor_kind ? (
                    <span className="text-xs text-[var(--muted)]"> · {e.actor_kind}</span>
                  ) : null}
                </p>
              </div>
              <p className="shrink-0 text-xs text-[var(--muted)]">
                {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}
              </p>
            </div>
            <p className="mt-2 text-sm font-medium">{humanize(e.action)}</p>
            <p className="text-xs text-[var(--muted)]">{categoryLabel(e.category)}</p>
            {e.summary ? <p className="mt-1 break-words text-sm">{e.summary}</p> : null}
            {e.detail_lines.length ? (
              <ul className="mt-1 space-y-0.5 break-words text-xs text-[var(--muted)]">
                {e.detail_lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </EventRow>
        ))}
        {!feed.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">No events yet.</li>
        ) : null}
      </ul>

      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/50 text-[var(--ink)]">
            <tr>
              <th className="px-4 py-3 font-bold">Ref No</th>
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">When</th>
              <th className="px-4 py-3 font-bold">Category</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Details</th>
            </tr>
          </thead>
          <tbody>
            {feed.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                as="tr"
                className="border-b border-[var(--line)] align-top last:border-0"
              >
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  {e.actor_name || "—"}
                  {e.actor_kind ? (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{e.actor_kind}</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                  {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">{categoryLabel(e.category)}</td>
                <td className="px-4 py-3 font-medium">{humanize(e.action)}</td>
                <td className="px-4 py-3">
                  {e.summary ? <p className="text-sm">{e.summary}</p> : null}
                  {e.detail_lines.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                      {e.detail_lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </EventRow>
            ))}
            {!feed.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  No events yet.
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
