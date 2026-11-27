import { statusChangeLabel } from "@/lib/ikman-republish";
import {
  formatPropertyChanges,
  type PropertyFieldChange,
} from "@/lib/property-field-diff";
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

function statusActivityLabel(action: string): string {
  if (action === "Publish") return "Queued for Publishing";
  return statusChangeLabel(action);
}

function auditActionLabel(
  action: string,
  summary: string | null,
  details: unknown,
): string {
  const platform = detailPlatform(details);
  switch (action) {
    case "approve":
      return "Approved for Publishing";
    case "decline":
      return "Social media declined";
    case "platform_done":
      return platform ? `Published on ${platform}` : "Published on platform";
    case "platform_undone":
      return platform ? `Unticked ${platform}` : "Platform unticked";
    case "publish":
      return "Publishing Completed";
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

function parseStoredChanges(details: unknown): PropertyFieldChange[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const raw = (details as { changes?: unknown }).changes;
  if (!Array.isArray(raw)) return [];
  const out: PropertyFieldChange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const from = typeof row.from === "string" ? row.from : displayFallback(row.from);
    const to = typeof row.to === "string" ? row.to : displayFallback(row.to);
    const field = typeof row.field === "string" ? row.field : label;
    if (!label) continue;
    out.push({ field, label, from, to });
  }
  return out;
}

function displayFallback(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
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
  // Title already names the platform — skip redundant tag.
  if (action === "platform_done") return null;
  if (action === "publish") {
    const platforms = Array.isArray(detail?.platforms)
      ? detail.platforms.map(String).filter(Boolean)
      : typeof detail?.platform === "string"
        ? [detail.platform]
        : [];
    if (platforms.length) return `Platforms: ${platforms.join(", ")}`;
  }
  if (action === "update") {
    return formatPropertyChanges(parseStoredChanges(details));
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

/** Lower = older when timestamps match (Listing created is the first record). */
function timelineTieBreak(action: string): number {
  if (action === "Listing created") return 0;
  if (action === "Queued for Publishing") return 1;
  return 2;
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
      action: statusActivityLabel(String(e.action)),
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
    .sort((a, b) => {
      const time =
        new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime();
      if (time !== 0) return time;
      return timelineTieBreak(b.action) - timelineTieBreak(a.action);
    })
    .slice(0, TIMELINE_LIMIT);
}
