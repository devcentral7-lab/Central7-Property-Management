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

export async function loadPropertyActivity(refNo: string): Promise<PropertyActivityEvent[]> {
  const supabase = await createClient();
  const [{ data: events }, { data: queue }] = await Promise.all([
    supabase
      .from("property_status_events")
      .select("id, occurred_at, actor_name, action, comment, requested_platforms, resolved_by")
      .eq("ref_no", refNo)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .limit(20),
    supabase
      .from("social_media_queue")
      .select("approved_action, approved_by, approved_at")
      .eq("ref_no", refNo)
      .maybeSingle(),
  ]);

  const rows = events ?? [];
  // The queue keeps one row per listing, so its approval belongs to the newest matching request.
  const approvedAt = queue?.approved_at ? new Date(queue.approved_at).getTime() : null;
  const approvedEventId =
    approvedAt != null && queue?.approved_by && queue.approved_action !== "Data Change"
      ? rows.find(
          (e) =>
            e.action === queue.approved_action &&
            new Date(e.occurred_at).getTime() <= approvedAt,
        )?.id
      : undefined;

  return rows.map((e) => {
    const isDataChange = e.action === "Data Change";
    const handledBy = isDataChange
      ? (e.resolved_by as string | null)
      : e.id === approvedEventId
        ? (queue?.approved_by as string)
        : null;
    return {
      id: String(e.id),
      action: String(e.action),
      actor_name: e.actor_name,
      handled_by: handledBy,
      handled_label: handledBy ? (isDataChange ? "Done by" : "Approved by") : null,
      awaiting_admin: isDataChange && !e.resolved_by,
      comment: e.comment,
      occurred_at: e.occurred_at,
      requested_platforms: Array.isArray(e.requested_platforms)
        ? e.requested_platforms.map(String)
        : [],
    };
  });
}
