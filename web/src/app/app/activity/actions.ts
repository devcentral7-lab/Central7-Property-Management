"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toResult, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

/** Queue actions after which the listing is live on its platforms. */
const LIVE_ACTIONS = ["Publish", "Republish", "New Ad Published", "Data Change"];

export type ResolveDataChangeResult = { queued: boolean; message: string };

/**
 * Admin marks a Data Change request as done. If the listing is live on social
 * media, it goes straight to the social media queue (pre-approved) so the
 * posts get updated too.
 */
export async function resolveDataChange(
  id: string,
): Promise<ActionResult<ResolveDataChangeResult>> {
  return toResult(() => resolve(id));
}

async function resolve(id: string): Promise<ResolveDataChangeResult> {
  const profile = await requireProfile();
  if (profile.role !== "Admin") {
    throw new Error("Only Admin can complete data change requests");
  }
  if (!id) throw new Error("Missing request");

  const supabase = await createClient();
  const { data: request, error: findErr } = await supabase
    .from("property_status_events")
    .select("id, property_id, ref_no, action, comment, actor_name, occurred_at, resolved_at")
    .eq("id", id)
    .single();
  if (findErr || !request) throw findErr ?? new Error("Request not found");
  if (request.action !== "Data Change") throw new Error("Not a data change request");
  if (request.resolved_at) throw new Error("Already marked as done");

  const [{ data: existing, error: queueReadErr }, { data: latestStatus }] = await Promise.all([
    supabase
      .from("social_media_queue")
      .select("approved_action, approved_at, completed_at, requested_platforms")
      .eq("ref_no", request.ref_no)
      .maybeSingle(),
    supabase
      .from("property_status_events")
      .select("action, occurred_at")
      .eq("ref_no", request.ref_no)
      .neq("action", "Data Change")
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (queueReadErr) throw queueReadErr;

  // When requests collide on the same listing, the newest one wins.
  const statusIsNewer =
    !!latestStatus &&
    new Date(latestStatus.occurred_at).getTime() > new Date(request.occurred_at).getTime();

  let platforms: string[] = [];
  let skipReason: string | null = null;
  let replaced: string | null = null;
  const takenDown = existing && !LIVE_ACTIONS.includes(existing.approved_action ?? "");
  if (existing && !existing.completed_at && takenDown && !statusIsNewer) {
    platforms = (existing.requested_platforms ?? []) as string[];
    replaced = existing.approved_action;
    if (!platforms.length) {
      skipReason = `${request.ref_no} isn't posted on any social media platform, so there is nothing to update.`;
    }
  } else if (existing && !existing.completed_at) {
    skipReason = takenDown
      ? `${request.ref_no} was changed to ${existing.approved_action} after this request and is queued to come off social media, so there is nothing to update.`
      : existing.approved_at
        ? `${request.ref_no} is already on the social media queue (${existing.approved_action}), so it will be posted with the updated details.`
        : `${request.ref_no} is already waiting for social media approval (${existing.approved_action}), so it will be posted with the updated details.`;
  } else if (takenDown) {
    skipReason = `${request.ref_no} was taken off social media (${existing.approved_action}), so there is nothing to update.`;
  } else {
    platforms = (existing?.requested_platforms ?? []) as string[];
    if (!platforms.length) {
      const { data: lastRequest } = await supabase
        .from("property_status_events")
        .select("requested_platforms")
        .eq("ref_no", request.ref_no)
        .neq("requested_platforms", "{}")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      platforms = (lastRequest?.requested_platforms ?? []) as string[];
    }
    if (!platforms.length) {
      skipReason = `${request.ref_no} isn't posted on any social media platform, so there is nothing to update.`;
    }
  }

  const now = new Date().toISOString();
  const message = skipReason
    ? skipReason
    : `Sent ${request.ref_no} to the social media queue to update on ${platforms.join(", ")}.${
        replaced ? ` It replaced the older ${replaced} item because this request is newer.` : ""
      }`;
  const { data: resolved, error: resolveErr } = await supabase
    .from("property_status_events")
    .update({ resolved_at: now, resolved_by: profile.display_name, resolution_note: message })
    .eq("id", id)
    .is("resolved_at", null)
    .select("id");
  if (resolveErr) throw resolveErr;
  if (!resolved?.length) throw new Error("Already marked as done");

  const queued = !skipReason;
  if (queued) {
    const { error: queueErr } = await supabase.from("social_media_queue").upsert(
      {
        property_id: request.property_id,
        ref_no: request.ref_no,
        approved_action: "Data Change",
        approved_by: profile.display_name,
        approved_at: now,
        requested_platforms: platforms,
        platform_dates: {},
        completed_at: null,
        comment: request.comment || null,
      },
      { onConflict: "ref_no" },
    );
    if (queueErr) {
      await supabase
        .from("property_status_events")
        .update({ resolved_at: null, resolved_by: null, resolution_note: null })
        .eq("id", id);
      throw queueErr;
    }
  }

  await logAudit({
    category: "property",
    action: "data_change_done",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: request.property_id,
    subjectLabel: request.ref_no,
    summary: queued
      ? `Data change done on ${request.ref_no} → social media queue (${platforms.join(", ")})`
      : `Data change done on ${request.ref_no}`,
    details: {
      requested_by: request.actor_name,
      comment: request.comment || null,
      social_media: queued ? undefined : skipReason,
      replaced_queue_item: replaced ?? undefined,
    },
  });

  revalidatePath("/app/activity");
  revalidatePath("/app/social-queue");
  revalidatePath("/app");
  revalidatePath(`/app/properties/${request.ref_no}`);

  return { queued, message };
}
