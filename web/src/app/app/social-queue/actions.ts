"use server";

import { revalidatePath } from "next/cache";
import { canAccessSocialQueue, requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toResult, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") {
    throw new Error("Only Admin can approve social media queue items");
  }
  return profile;
}

/** Admins plus anyone on the social media queue allow-list. */
async function requireQueueOperator() {
  const profile = await requireProfile();
  if (!(await canAccessSocialQueue(profile))) {
    throw new Error("You don't have access to the social media queue");
  }
  return profile;
}

function revalidateQueue() {
  revalidatePath("/app/social-queue");
  revalidatePath("/app/activity");
  revalidatePath("/app");
}

function missingPlatforms(
  requested: string[] | null,
  dates: Record<string, unknown> | null,
): string[] {
  const done = dates ?? {};
  return (requested ?? []).filter((p) => !(p in done));
}

export async function approveSocialQueueItem(formData: FormData): Promise<ActionResult> {
  return toResult(() => approve(formData));
}

export async function declineSocialQueueItem(formData: FormData): Promise<ActionResult> {
  return toResult(() => decline(formData));
}

export async function setSocialQueuePlatform(
  id: string,
  platform: string,
  done: boolean,
): Promise<ActionResult> {
  return toResult(() => setPlatform(id, platform, done));
}

export async function publishSocialQueueItem(formData: FormData): Promise<ActionResult> {
  return toResult(() => publish(formData));
}

export async function revertSocialQueueItem(formData: FormData): Promise<ActionResult> {
  return toResult(() => revert(formData));
}

async function approve(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing queue item");

  const { data: row, error: findErr } = await supabase
    .from("social_media_queue")
    .select("id, ref_no, completed_at, approved_at, requested_platforms")
    .eq("id", id)
    .single();
  if (findErr || !row) throw findErr ?? new Error("Queue item not found");
  if (row.completed_at) {
    throw new Error("Already published — cannot approve again");
  }

  const requested = (row.requested_platforms ?? []) as string[];
  const chosen = new Set(formData.getAll("platforms").map((v) => str(v)));
  const approved = requested.filter((p) => chosen.has(p));
  const dropped = requested.filter((p) => !chosen.has(p));
  if (requested.length && !approved.length) {
    throw new Error("Select at least one platform to approve");
  }

  const { error } = await supabase
    .from("social_media_queue")
    .update({
      approved_by: profile.display_name,
      approved_at: new Date().toISOString(),
      requested_platforms: approved as typeof row.requested_platforms,
    })
    .eq("id", id);
  if (error) throw error;

  await logAudit({
    category: "queue",
    action: "approve",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: row.id,
    subjectLabel: row.ref_no,
    summary: approved.length
      ? `Approved ${row.ref_no} for ${approved.join(", ")}`
      : `Approved social media queue item ${row.ref_no}`,
    details: dropped.length ? { approved, not_approved: dropped } : undefined,
  });

  revalidateQueue();
}

async function decline(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const id = str(formData.get("id"));
  const reason = str(formData.get("reason"));
  if (!id) throw new Error("Missing queue item");

  const { data: row, error: findErr } = await supabase
    .from("social_media_queue")
    .select("id, ref_no, approved_action, requested_platforms")
    .eq("id", id)
    .is("approved_at", null)
    .is("completed_at", null)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!row) throw new Error("This request was already approved or removed");

  const { error } = await supabase
    .from("social_media_queue")
    .delete()
    .eq("id", id)
    .is("approved_at", null)
    .is("completed_at", null);
  if (error) throw error;

  await logAudit({
    category: "queue",
    action: "decline",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: row.id,
    subjectLabel: row.ref_no,
    summary: `Declined ${row.approved_action ?? "social media"} request for ${row.ref_no}`,
    details: {
      reason: reason || null,
      platforms: row.requested_platforms,
    },
  });

  revalidateQueue();
}

async function setPlatform(id: string, platform: string, done: boolean) {
  const profile = await requireQueueOperator();
  if (!id || !platform) throw new Error("Missing queue item or platform");
  const supabase = await createClient();

  const { data: row, error: findErr } = await supabase
    .from("social_media_queue")
    .select("id, ref_no")
    .eq("id", id)
    .single();
  if (findErr || !row) throw findErr ?? new Error("Queue item not found");

  const { error } = await supabase.rpc("set_smq_platform_done", {
    p_id: id,
    p_platform: platform,
    p_done: done,
  });
  if (error) throw new Error(error.message);

  await logAudit({
    category: "queue",
    action: done ? "platform_done" : "platform_undone",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: row.id,
    subjectLabel: row.ref_no,
    summary: done
      ? `Posted ${row.ref_no} on ${platform}`
      : `Unticked ${platform} for ${row.ref_no}`,
    details: { platform },
  });

  revalidatePath("/app/social-queue");
}

async function publish(formData: FormData) {
  const profile = await requireQueueOperator();
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing queue item");

  const { data: row, error: findErr } = await supabase
    .from("social_media_queue")
    .select("id, ref_no, completed_at, approved_at, approved_action, requested_platforms, platform_dates")
    .eq("id", id)
    .single();
  if (findErr || !row) throw findErr ?? new Error("Queue item not found");
  if (!row.approved_at) {
    throw new Error("Approve this item before marking it done");
  }
  if (row.completed_at) {
    throw new Error("Already done");
  }
  const missing = missingPlatforms(row.requested_platforms, row.platform_dates);
  if (missing.length) {
    throw new Error(`Tick ${missing.join(", ")} before marking done`);
  }

  const { error } = await supabase
    .from("social_media_queue")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  await logAudit({
    category: "queue",
    action: "publish",
    actorName: profile.display_name,
    actorKind: "staff",
    subjectType: "property",
    subjectId: row.id,
    subjectLabel: row.ref_no,
    summary: `Marked social media queue item ${row.ref_no} as done`,
    details: {
      queue_action: row.approved_action,
      platforms: row.requested_platforms,
    },
  });

  revalidateQueue();
}

async function revert(formData: FormData) {
  const profile = await requireQueueOperator();
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing queue item");

  const { data: row, error: findErr } = await supabase
    .from("social_media_queue")
    .select("id, ref_no, completed_at, approved_at")
    .eq("id", id)
    .single();
  if (findErr || !row) throw findErr ?? new Error("Queue item not found");

  if (row.completed_at) {
    const { error } = await supabase
      .from("social_media_queue")
      .update({ completed_at: null })
      .eq("id", id);
    if (error) throw error;

    await logAudit({
      category: "queue",
      action: "revert_publish",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectId: row.id,
      subjectLabel: row.ref_no,
      summary: `Reopened ${row.ref_no} on the social media queue`,
    });
  } else if (row.approved_at) {
    if (profile.role !== "Admin") {
      throw new Error("Only Admin can revert an approval");
    }
    const { error } = await supabase
      .from("social_media_queue")
      .update({
        approved_at: null,
        approved_by: null,
      })
      .eq("id", id);
    if (error) throw error;

    await logAudit({
      category: "queue",
      action: "revert_approve",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectId: row.id,
      subjectLabel: row.ref_no,
      summary: `Reverted approval for ${row.ref_no}`,
    });
  } else {
    throw new Error("Nothing to revert");
  }

  revalidateQueue();
}
