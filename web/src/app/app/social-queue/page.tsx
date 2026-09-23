import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSocialQueue, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PropertyLink } from "@/app/app/properties/property-modal";
import {
  SocialQueueActions,
  SocialQueueStatusBadge,
  type SocialQueueStatus,
} from "@/app/app/social-queue/queue-actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function statusOf(row: {
  approved_at: string | null;
  completed_at: string | null;
}): SocialQueueStatus {
  if (row.completed_at) return "published";
  if (row.approved_at) return "approved";
  return "pending";
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
  const tab = one(sp.tab).toLowerCase() === "past" ? "past" : "active";
  const isAdmin = profile.role === "Admin";
  const supabase = await createClient();

  let query = supabase
    .from("social_media_queue")
    .select("*")
    .limit(100);

  if (tab === "past") {
    query = query
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
  } else {
    query = query
      .is("completed_at", null)
      .order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) return <p className="text-[var(--danger)]">{error.message}</p>;

  const tabs = [
    { id: "active" as const, label: "Active", href: "/app/social-queue" },
    {
      id: "past" as const,
      label: "Past queue",
      href: "/app/social-queue?tab=past",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Social media queue</h1>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
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

      <ul className="mt-6 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {(data ?? []).map((row) => {
          const status = statusOf(row);
          const platforms =
            Array.isArray(row.requested_platforms) &&
            row.requested_platforms.length
              ? row.requested_platforms.join(", ")
              : "No platforms";
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <PropertyLink refNo={row.ref_no}>{row.ref_no}</PropertyLink>
                  <SocialQueueStatusBadge status={status} />
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {platforms}
                  {row.approved_by ? ` · approved by ${row.approved_by}` : ""}
                  {row.completed_at
                    ? ` · published ${new Date(row.completed_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
              {isAdmin ? (
                <SocialQueueActions id={row.id} status={status} />
              ) : null}
            </li>
          );
        })}
        {!data?.length ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {tab === "past" ? "No past queue items." : "Queue empty."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
