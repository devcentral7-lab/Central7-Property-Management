import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  SocialQueueActions,
  SocialQueueStatusBadge,
  type SocialQueueStatus,
} from "@/app/app/social-queue/queue-actions";
import { PropertyLink, PropertyRow } from "@/app/app/properties/property-modal";
import { LinkRow } from "@/components/clickable-row";
import { LiveFilterForm } from "@/components/live-filter-form";
import { requireProfile } from "@/lib/auth";
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
  queue_id?: string;
  queue_status?: SocialQueueStatus;
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

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "social", label: "Social media approvals" },
  { id: "auth", label: "Logins" },
  { id: "property", label: "Properties" },
  { id: "staff", label: "Staff" },
  { id: "partner", label: "Partners" },
  { id: "settings", label: "Settings" },
  { id: "workflow", label: "Workflow" },
] as const;

function formatDetails(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }
  return Object.entries(details as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const value =
        typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}: ${value}`;
    })
    .slice(0, 8);
}

function socialStatus(row: {
  approved_at: string | null;
  completed_at: string | null;
}): SocialQueueStatus {
  if (row.completed_at) return "published";
  if (row.approved_at) return "approved";
  return "pending";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");

  const sp = await searchParams;
  const category = one(sp.category).toLowerCase() || "all";
  const q = one(sp.q).trim().toLowerCase();
  const supabase = await createClient();

  const [
    { data: auditRows, error: auditErr },
    { data: workflowRows, error: wfErr },
    { data: socialRows, error: socialErr },
  ] = await Promise.all([
    supabase
      .from("audit_log")
      .select(
        "id, occurred_at, category, action, actor_name, actor_kind, subject_type, subject_id, subject_label, summary, details, ip, user_agent",
      )
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("property_status_events")
      .select(
        "id, occurred_at, ref_no, actor_name, action, comment, assigned_to, requested_platforms",
      )
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("social_media_queue")
      .select(
        "id, ref_no, approved_action, approved_by, approved_at, requested_platforms, completed_at, created_at, updated_at",
      )
      .is("approved_at", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (auditErr || wfErr || socialErr) {
    return (
      <p className="text-[var(--danger)]">
        {auditErr?.message || wfErr?.message || socialErr?.message}
      </p>
    );
  }

  const feed: FeedRow[] = [];

  for (const row of auditRows ?? []) {
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
          : null,
      summary: row.summary,
      detail_lines: details,
    });
  }

  for (const row of workflowRows ?? []) {
    const platforms = Array.isArray(row.requested_platforms)
      ? row.requested_platforms.join(", ")
      : "";
    const details = [
      row.comment ? `comment: ${row.comment}` : null,
      row.assigned_to ? `assigned: ${row.assigned_to}` : null,
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
      summary: `${row.action} on ${row.ref_no}${
        row.assigned_to ? ` → ${row.assigned_to}` : ""
      }`,
      detail_lines: details,
    });
  }

  for (const row of socialRows ?? []) {
    const status = socialStatus(row);
    const platforms =
      Array.isArray(row.requested_platforms) && row.requested_platforms.length
        ? row.requested_platforms.join(", ")
        : "No platforms";
    const occurred =
      row.completed_at ||
      row.approved_at ||
      row.updated_at ||
      row.created_at;
    feed.push({
      id: `smq-${row.id}`,
      occurred_at: occurred,
      category: "social",
      action: "awaiting_approval",
      actor_name: null,
      actor_kind: null,
      subject_label: row.ref_no,
      subject_href: `/app/properties/${row.ref_no}`,
      summary: `${row.ref_no} · ${platforms}`,
      detail_lines: [
        "Needs approval before it appears on the Social media queue",
        row.approved_action ? `intent: ${row.approved_action}` : null,
      ].filter(Boolean) as string[],
      queue_id: row.id,
      queue_status: status,
    });
  }

  feed.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  const filtered = feed.filter((row) => {
    if (category === "social") {
      if (!row.queue_id) return false;
    } else if (category !== "all" && row.category !== category) {
      return false;
    }
    if (!q) return true;
    const hay = [
      row.action,
      row.actor_name,
      row.subject_label,
      row.summary,
      ...row.detail_lines,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const visible = filtered.slice(0, 150);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Activity log</h1>

      <LiveFilterForm
        action="/app/activity"
        className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="text-sm font-medium">
          Category
          <select
            name="category"
            defaultValue={category}
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
          const href =
            c.id === "all"
              ? q
                ? `/app/activity?q=${encodeURIComponent(q)}`
                : "/app/activity"
              : `/app/activity?category=${c.id}${
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
        Showing {visible.length} of {filtered.length} matched events (latest
        first).
      </p>

      <ul className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] md:hidden">
        {visible.map((e) => (
          <EventRow key={e.id} e={e} as="li" className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{e.action}</p>
                <p className="text-xs capitalize text-[var(--muted)]">
                  {e.category === "social" ? "Social media" : e.category}
                  {" · "}
                  {e.occurred_at
                    ? new Date(e.occurred_at).toLocaleString()
                    : "—"}
                </p>
              </div>
              {e.subject_href && e.subject_label ? (
                <div className="shrink-0 text-sm">
                  {e.subject_href.startsWith("/app/properties/") ? (
                    <PropertyLink refNo={e.subject_label}>
                      {e.subject_label}
                    </PropertyLink>
                  ) : (
                    <Link
                      href={e.subject_href}
                      className="font-semibold text-[var(--brand-deep)] hover:underline"
                    >
                      {e.subject_label}
                    </Link>
                  )}
                </div>
              ) : e.subject_label ? (
                <span className="shrink-0 text-sm">{e.subject_label}</span>
              ) : null}
            </div>
            {e.actor_name ? (
              <p className="mt-1 text-sm">
                {e.actor_name}
                {e.actor_kind ? (
                  <span className="text-xs text-[var(--muted)]">
                    {" "}
                    · {e.actor_kind}
                  </span>
                ) : null}
              </p>
            ) : null}
            {e.summary ? (
              <p className="mt-1 break-words text-sm">{e.summary}</p>
            ) : null}
            {e.detail_lines.length ? (
              <ul className="mt-1 space-y-0.5 break-words text-xs text-[var(--muted)]">
                {e.detail_lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {e.queue_id && e.queue_status ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SocialQueueStatusBadge status={e.queue_status} />
                <SocialQueueActions
                  id={e.queue_id}
                  status={e.queue_status}
                  mode="activity"
                />
              </div>
            ) : null}
          </EventRow>
        ))}
        {!visible.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No events yet.
          </li>
        ) : null}
      </ul>

      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-accent)]/50 text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                as="tr"
                className="border-b border-[var(--line)] align-top last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                  {e.occurred_at
                    ? new Date(e.occurred_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-3 capitalize">
                  {e.category === "social" ? "Social media" : e.category}
                </td>
                <td className="px-4 py-3 font-medium">{e.action}</td>
                <td className="px-4 py-3">
                  {e.actor_name || "—"}
                  {e.actor_kind ? (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {e.actor_kind}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {e.subject_href && e.subject_label ? (
                    e.subject_href.startsWith("/app/properties/") ? (
                      <PropertyLink refNo={e.subject_label}>
                        {e.subject_label}
                      </PropertyLink>
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
                  {e.summary ? (
                    <p className="text-sm">{e.summary}</p>
                  ) : null}
                  {e.detail_lines.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                      {e.detail_lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {e.queue_id && e.queue_status ? (
                    <div className="space-y-2">
                      <SocialQueueStatusBadge status={e.queue_status} />
                      <SocialQueueActions
                        id={e.queue_id}
                        status={e.queue_status}
                        mode="activity"
                      />
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </EventRow>
            ))}
            {!visible.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                >
                  No events yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
