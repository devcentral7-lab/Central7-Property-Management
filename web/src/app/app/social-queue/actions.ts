"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") {
    throw new Error("Only Admin can update the social media queue");
  }
  return profile;
}

export async function approveSocialQueueItem(formData: FormData) {
  const profile = await requireAdmin();
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
    throw new Error("Already published — cannot approve again");
  }

  const { error } = await supabase
    .from("social_media_queue")
    .update({
      approved_by: profile.display_name,
      approved_at: new Date().toISOString(),
      approved_action: "Approved",
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
    summary: `Approved social media queue item ${row.ref_no}`,
  });

  revalidatePath("/app/social-queue");
  revalidatePath("/app/activity");
  revalidatePath("/app");
}

export async function publishSocialQueueItem(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (!id) throw new Error("Missing queue item");

  const { data: row, error: findErr } = await supabase
    .from("social_media_queue")
    .select("id, ref_no, completed_at, approved_at")
    .eq("id", id)
    .single();
  if (findErr || !row) throw findErr ?? new Error("Queue item not found");
  if (!row.approved_at) {
    throw new Error("Approve this item before marking it published");
  }
  if (row.completed_at) {
    throw new Error("Already published");
  }

  const { error } = await supabase
    .from("social_media_queue")
    .update({
      completed_at: new Date().toISOString(),
      approved_action: "Published",
    })
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
    summary: `Marked social media queue item ${row.ref_no} as published`,
  });

  revalidatePath("/app/social-queue");
  revalidatePath("/app/activity");
  revalidatePath("/app");
}

export async function revertSocialQueueItem(formData: FormData) {
  const profile = await requireAdmin();
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
      .update({
        completed_at: null,
        approved_action: row.approved_at ? "Approved" : "Publish",
      })
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
      summary: `Reverted published status for ${row.ref_no}`,
    });
  } else if (row.approved_at) {
    const { error } = await supabase
      .from("social_media_queue")
      .update({
        approved_at: null,
        approved_by: null,
        approved_action: "Publish",
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

  revalidatePath("/app/social-queue");
  revalidatePath("/app/activity");
  revalidatePath("/app");
}
