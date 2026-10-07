import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSocialQueue, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PropertyLink } from "@/app/app/properties/property-modal";
import { StatusBadge } from "@/components/status-badge";
import { PhoneWithWhatsApp } from "@/components/whatsapp-link";
import { LiveFilterForm } from "@/components/live-filter-form";
import {
  QueueItemCard,
  type PlatformDates,
} from "@/app/app/social-queue/queue-actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type QueueProperty = {
  opportunity_type: string | null;
  property_type: string | null;
  city: string | null;
  status: string | null;
  contact_name: string | null;
  contact_phone_1: string | null;
} | null;

const SELECT =
  "id, ref_no, approved_action, approved_by, approved_at, completed_at, requested_platforms, platform_dates, comment, property:properties(opportunity_type, property_type, city, status, contact_name, contact_phone_1)";

const STATUS_OPTIONS = [
  "Publish",
  "New Ad Published",
  "Republish",
  "Data Change",
  "Drop",
  "Lost",
  "Hold",
  "Closed",
];

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });
}

export default async function SocialQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  if (!(await canAccessSocialQueue(profile))) {
    redirect("/app");
  }

  const sp = await searchParams;
  const tab =
    one(sp.tab).toLowerCase() === "published" ? "published" : "pending";
  const requestedStatus = one(sp.status);
  const status = STATUS_OPTIONS.includes(requestedStatus) ? requestedStatus : "";
  const supabase = await createClient();

  const statusMatch = status ? { approved_action: status } : {};

  // Only approved (or done) items appear here — pending approval stays on Activity.
  // Separate query chains avoid Supabase TS "excessively deep" errors.
  const { data, error } =
    tab === "published"
      ? await supabase
          .from("social_media_queue")
          .select(SELECT)
          .not("approved_at", "is", null)
          .not("completed_at", "is", null)
          .match(statusMatch)
          .order("completed_at", { ascending: false })
          .limit(100)
      : await supabase
          .from("social_media_queue")
          .select(SELECT)
          .not("approved_at", "is", null)
          .is("completed_at", null)
          .match(statusMatch)
          .order("approved_at", { ascending: false })
          .limit(100);

  if (error) return <p className="text-[var(--danger)]">{error.message}</p>;

  const statusQs = status ? `status=${encodeURIComponent(status)}` : "";
  const tabs = [
    {
      id: "pending" as const,
      label: "Pending",
      href: `/app/social-queue${statusQs ? `?${statusQs}` : ""}`,
    },
    {
      id: "published" as const,
      label: "Done",
      href: `/app/social-queue?tab=published${statusQs ? `&${statusQs}` : ""}`,
    },
  ];

  const rows = data ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Social Media Queue</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Items appear here after approval on the Activity log. Tick each platform
        as you post it — Done unlocks once every platform is ticked.
      </p>

      <div className="mt-5 flex flex-col gap-3 border-b border-[var(--line)] pb-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="tab-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <LiveFilterForm action="/app/social-queue" className="sm:shrink-0">
        <input type="hidden" name="tab" value={tab === "published" ? "published" : ""} readOnly />
        <label className="flex items-center gap-2 text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm sm:w-48"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </LiveFilterForm>
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        {rows.length} {rows.length === 1 ? "item" : "items"}
        {rows.length === 100 ? " (showing latest 100)" : ""}
      </p>

      <ul className="mt-3 space-y-3">
        {rows.map((row) => {
          const property = (Array.isArray(row.property)
            ? row.property[0]
            : row.property) as QueueProperty;
          const platforms = (row.requested_platforms ?? []) as string[];
          const dates = (row.platform_dates ?? {}) as PlatformDates;
          const summary = [
            property?.opportunity_type,
            property?.property_type,
            property?.city,
          ].filter(Boolean);

          return (
            <li
              key={row.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm sm:p-5"
            >
              <QueueItemCard
                id={row.id}
                done={Boolean(row.completed_at)}
                platforms={platforms}
                dates={dates}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">
                    <PropertyLink refNo={row.ref_no}>{row.ref_no}</PropertyLink>
                  </span>
                  {row.approved_action ? (
                    <span className="inline-flex rounded-full border border-[var(--brand)]/50 px-2.5 py-0.5 text-xs font-semibold text-[var(--brand)]">
                      {row.approved_action}
                    </span>
                  ) : null}
                </div>

                {row.approved_action === "Data Change" && row.comment ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span className="font-semibold">What changed:</span> {row.comment}
                  </p>
                ) : null}

                <div className="mt-2 space-y-0.5 text-sm text-[var(--muted)]">
                  {summary.length || property?.status ? (
                    <p>
                      {summary.join(" · ")}
                      {property?.status ? (
                        <>
                          {summary.length ? " · " : ""}Current status:{" "}
                          <StatusBadge status={property.status} />
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {row.approved_by ? (
                    <p>
                      Approved by{" "}
                      <span className="font-semibold text-[var(--ink)]">{row.approved_by}</span>
                      {row.approved_at ? ` on ${formatDateTime(row.approved_at)}` : ""}
                    </p>
                  ) : null}
                  {row.completed_at ? (
                    <p>Done on {formatDateTime(row.completed_at)}</p>
                  ) : null}
                  {property?.contact_name || property?.contact_phone_1 ? (
                    <p>
                      {property?.contact_name ? (
                        <span className="font-semibold text-[var(--ink)]">
                          {property.contact_name}
                        </span>
                      ) : null}
                      {property?.contact_name && property?.contact_phone_1 ? " · " : ""}
                      {property?.contact_phone_1 ? (
                        <PhoneWithWhatsApp phone={property.contact_phone_1}>
                          <a
                            href={`tel:${property.contact_phone_1}`}
                            data-nav-skip
                            className="font-semibold text-[var(--brand)] hover:underline"
                          >
                            {property.contact_phone_1}
                          </a>
                        </PhoneWithWhatsApp>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </QueueItemCard>
            </li>
          );
        })}
        {!rows.length ? (
          <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            {status
              ? `No ${tab === "published" ? "done" : "pending"} ${status} items.`
              : tab === "published"
              ? "No done items yet."
              : "No pending items. Approve requests from the Activity log first."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
