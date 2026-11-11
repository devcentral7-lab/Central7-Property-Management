import { statusChangeLabel } from "@/lib/ikman-republish";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PropertyActivityEvent = {
  id: string;
  action: string;
  actor_name: string | null;
  /** Admin who completed a Data Change or approved a queue request. */
  handled_by: string | null;
  handled_label: "Done by" | "Approved by" | null;
  /** A Data Change no admin has completed yet. */
  awaiting_admin: boolean;
  comment: string | null;
  occurred_at: string | null;
  requested_platforms: string[];
};

const TIMELINE_LIMIT = 40;

function detailPlatform(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const platform = (details as { platform?: unknown }).platform;
  return typeof platform === "string" && platform.trim() ? platform.trim() : null;
}

function auditActionLabel(
  action: string,
  summary: string | null,
  details: unknown,
): string {
  const platform = detailPlatform(details);
  switch (action) {
    case "approve":
      return "Social media approved";
    case "decline":
      return "Social media declined";
    case "platform_done":
      return platform ? `Posted on ${platform}` : "Posted on platform";
    case "platform_undone":
      return platform ? `Unticked ${platform}` : "Platform unticked";
    case "publish":
      return "Social media marked done";
    case "revert_publish":
      return "Social media reopened";
    case "revert_approve":
      return "Social media approval reverted";
    case "photo_upload":
      return "Photos uploaded";
    case "photo_delete":
      return "Photo deleted";
    case "photo_rename":
      return "Photo renamed";
    case "create":
      return "Listing created";
    case "update":
      return "Listing updated";
    case "data_change_done":
      return "Data change completed";
    case "ikman_republish_approved":
      return "Ikman republish approved";
    case "ikman_republish_declined":
      return "Ikman republish declined";
    case "ikman_republish_completed":
      return "Ikman marked republished";
    case "ikman_republish_force_reask":
      return "Ikman force re-asked";
    case "ikman_republish_batch":
      return "Ikman import batch";
    default:
      return summary || action.replace(/_/g, " ");
  }
}

function auditComment(
  action: string,
  summary: string | null,
  details: unknown,
): string | null {
  const detail =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : null;
  if (action === "decline" && typeof detail?.reason === "string" && detail.reason.trim()) {
    return detail.reason.trim();
  }
  if (action === "approve") {
    const approved = Array.isArray(detail?.approved)
      ? detail.approved.map(String).filter(Boolean)
      : [];
    if (approved.length) return `Platforms: ${approved.join(", ")}`;
  }
  if (action === "publish" || action === "platform_done") {
    const platforms = Array.isArray(detail?.platforms)
      ? detail.platforms.map(String).filter(Boolean)
      : typeof detail?.platform === "string"
        ? [detail.platform]
        : [];
    if (platforms.length) return `Platforms: ${platforms.join(", ")}`;
  }
  if (action === "photo_upload" && detail?.count != null) {
    return `${detail.count} file(s)`;
  }
  // Prefer short detail over repeating the title-like summary.
  if (summary && !summary.toLowerCase().includes(action.replace(/_/g, " "))) {
    return summary;
  }
  return null;
}

export async function loadPropertyActivity(refNo: string): Promise<PropertyActivityEvent[]> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: events }, { data: audits }] = await Promise.all([
    supabase
      .from("property_status_events")
      .select("id, occurred_at, actor_name, action, comment, requested_platforms, resolved_by")
      .eq("ref_no", refNo)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .limit(TIMELINE_LIMIT),
    admin
      .from("audit_log")
      .select("id, occurred_at, category, action, actor_name, summary, details")
      .in("category", ["queue", "property"])
      .eq("subject_label", refNo)
      .order("occurred_at", { ascending: false })
      .limit(TIMELINE_LIMIT),
  ]);

  const statusRows: PropertyActivityEvent[] = (events ?? []).map((e) => {
    const isDataChange = e.action === "Data Change";
    const handledBy = isDataChange ? (e.resolved_by as string | null) : null;
    return {
      id: `status-${e.id}`,
      action: statusChangeLabel(String(e.action)),
      actor_name: e.actor_name,
      handled_by: handledBy,
      handled_label: handledBy ? ("Done by" as const) : null,
      awaiting_admin: isDataChange && !e.resolved_by,
      comment: e.comment,
      occurred_at: e.occurred_at,
      requested_platforms: Array.isArray(e.requested_platforms)
        ? e.requested_platforms.map(String)
        : [],
    };
  });

  const auditRows: PropertyActivityEvent[] = [];
  for (const a of audits ?? []) {
    // Already covered by property_status_events (+ Done by on Data Change).
    if (a.category === "property" && String(a.action).startsWith("status:")) continue;
    if (a.action === "data_change_done") continue;

    const label = auditActionLabel(String(a.action), a.summary, a.details);
    auditRows.push({
      id: `audit-${a.id}`,
      action: label,
      actor_name: a.actor_name,
      handled_by: null,
      handled_label: null,
      awaiting_admin: false,
      comment: auditComment(String(a.action), a.summary, a.details),
      occurred_at: a.occurred_at,
      requested_platforms: [],
    });
  }

  return [...statusRows, ...auditRows]
    .sort(
      (a, b) =>
        new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime(),
    )
    .slice(0, TIMELINE_LIMIT);
}
