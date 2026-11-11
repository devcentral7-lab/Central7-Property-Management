"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { toResult, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import {
  extractIkmanRefNos,
  IKMAN_ITEM_STATUSES,
  type IkmanItemStatus,
  type IkmanPreviewRow,
} from "@/lib/ikman-republish";
import { createClient } from "@/lib/supabase/server";

type PropertyRow = {
  id: string;
  ref_no: string;
  status: string;
  created_by: string | null;
  created_by_name: string | null;
  property_type: string | null;
  opportunity_type: string | null;
  city: string | null;
};

type ItemRow = {
  id: string;
  ref_no: string;
  status: IkmanItemStatus;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
};

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") throw new Error("Admin only");
  return profile;
}

function revalidateIkman() {
  revalidatePath("/app/ikman-republish");
  revalidatePath("/app/ikman-decisions");
  revalidatePath("/app");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function previewIkmanPaste(rawText: string): Promise<ActionResult<IkmanPreviewRow[]>> {
  return toResult(async () => {
    await requireAdmin();
    const refs = extractIkmanRefNos(rawText);
    if (!refs.length) return [];

    const supabase = await createClient();
    const properties = new Map<string, PropertyRow>();
    const openItems = new Map<string, ItemRow>();
    const latestItems = new Map<string, ItemRow>();

    for (const group of chunk(refs, 100)) {
      const [{ data: props }, { data: items }] = await Promise.all([
        supabase
          .from("properties")
          .select(
            "id, ref_no, status, created_by, created_by_name, property_type, opportunity_type, city",
          )
          .in("ref_no", group),
        supabase
          .from("ikman_republish_items")
          .select("id, ref_no, status, owner_id, owner_name, created_at")
          .in("ref_no", group)
          .order("created_at", { ascending: false }),
      ]);

      for (const p of (props ?? []) as PropertyRow[]) properties.set(p.ref_no, p);
      for (const item of (items ?? []) as ItemRow[]) {
        if (!latestItems.has(item.ref_no)) latestItems.set(item.ref_no, item);
        if (
          (item.status === "pending_owner" || item.status === "approved_by_owner") &&
          !openItems.has(item.ref_no)
        ) {
          openItems.set(item.ref_no, item);
        }
      }
    }

    return refs.map((ref_no): IkmanPreviewRow => {
      const property = properties.get(ref_no) ?? null;
      const open = openItems.get(ref_no) ?? null;
      const latest = latestItems.get(ref_no) ?? null;

      if (!property) {
        return {
          ref_no,
          disposition: "not_found",
          defaultInclude: false,
          property_id: null,
          property_status: null,
          owner_id: null,
          owner_name: null,
          property_type: null,
          opportunity_type: null,
          city: null,
          existing_item_id: latest?.id ?? null,
          existing_status: latest?.status ?? null,
          note: "No matching listing.",
        };
      }

      const owner_id = property.created_by;
      const owner_name = property.created_by_name;
      const base = {
        ref_no,
        property_id: property.id,
        property_status: property.status,
        owner_id,
        owner_name,
        property_type: property.property_type,
        opportunity_type: property.opportunity_type,
        city: property.city,
        existing_item_id: open?.id ?? latest?.id ?? null,
        existing_status: (open?.status ?? latest?.status ?? null) as IkmanItemStatus | null,
      };

      if (property.status !== "Active") {
        return {
          ...base,
          disposition: "not_active",
          defaultInclude: false,
          note: `Listing status is ${property.status}.`,
        };
      }

      if (!owner_id && !owner_name) {
        return {
          ...base,
          disposition: "no_owner",
          defaultInclude: false,
          note: "Listing has no creator to decide.",
        };
      }

      if (open?.status === "pending_owner") {
        return {
          ...base,
          disposition: "pending_owner",
          defaultInclude: false,
          note: "Already waiting on the owner.",
        };
      }

      if (open?.status === "approved_by_owner") {
        return {
          ...base,
          disposition: "pending_admin",
          defaultInclude: false,
          note: "Owner already approved — in Admin ready queue.",
        };
      }

      if (latest?.status === "declined_by_owner") {
        return {
          ...base,
          disposition: "suppressed",
          defaultInclude: false,
          note: "Owner declined previously. Force-include to ask again.",
        };
      }

      if (latest?.status === "republished") {
        return {
          ...base,
          disposition: "recently_done",
          defaultInclude: false,
          note: "Already marked republished. Force-include if it expired again.",
        };
      }

      return {
        ...base,
        disposition: "new",
        defaultInclude: true,
        note: "Will send to owner for an Ikman republish decision.",
      };
    });
  });
}

export type EnqueueIkmanInput = {
  rawText: string;
  /** Refs Admin chose to send/force to owners. */
  includeRefs: string[];
  notes?: string;
};

export async function enqueueIkmanBatch(
  input: EnqueueIkmanInput,
): Promise<ActionResult<{ batchId: string; enqueued: number; skipped: number }>> {
  return toResult(async () => {
    const profile = await requireAdmin();
    const refs = [...new Set(input.includeRefs.map((r) => r.trim().toUpperCase()).filter(Boolean))];
    if (!refs.length) throw new Error("Select at least one listing to send to owners.");

    const preview = await previewIkmanPaste(input.rawText);
    if (!preview.ok) throw new Error(preview.error);
    const byRef = new Map(preview.data.map((r) => [r.ref_no, r]));

    const toEnqueue: IkmanPreviewRow[] = [];
    for (const ref of refs) {
      const row = byRef.get(ref);
      if (!row) throw new Error(`${ref} was not in the parsed paste.`);
      if (row.disposition === "not_found" || row.disposition === "not_active" || row.disposition === "no_owner") {
        throw new Error(`${ref} cannot be enqueued (${row.note}).`);
      }
      if (row.disposition === "pending_owner" || row.disposition === "pending_admin") {
        continue; // already open — skip silently on confirm
      }
      // new | suppressed | recently_done (force-include)
      toEnqueue.push(row);
    }

    const supabase = await createClient();
    const parsedCount = extractIkmanRefNos(input.rawText).length;
    const skipped = Math.max(0, parsedCount - toEnqueue.length);

    const { data: batch, error: batchErr } = await supabase
      .from("ikman_republish_batches")
      .insert({
        created_by: profile.id,
        created_by_name: profile.display_name,
        raw_text: input.rawText.slice(0, 200_000),
        parsed_ref_count: parsedCount,
        enqueued_count: toEnqueue.length,
        skipped_count: skipped,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single();
    if (batchErr || !batch) throw new Error(batchErr?.message || "Could not create batch.");

    // Cancel prior declined rows we are force-replacing so history stays clear.
    const forceRefs = toEnqueue
      .filter((r) => r.disposition === "suppressed" && r.existing_item_id)
      .map((r) => r.existing_item_id!) ;
    if (forceRefs.length) {
      await supabase
        .from("ikman_republish_items")
        .update({ status: "cancelled", suppressed_until: null })
        .in("id", forceRefs)
        .eq("status", "declined_by_owner");
    }

    if (toEnqueue.length) {
      const { error: insertErr } = await supabase.from("ikman_republish_items").insert(
        toEnqueue.map((r) => ({
          batch_id: batch.id,
          ref_no: r.ref_no,
          property_id: r.property_id,
          owner_id: r.owner_id,
          owner_name: r.owner_name,
          status: "pending_owner" as const,
          suppressed_until: null,
        })),
      );
      if (insertErr) throw new Error(insertErr.message);
    }

    await logAudit({
      category: "queue",
      action: "ikman_republish_batch",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "ikman_batch",
      subjectId: batch.id,
      subjectLabel: toEnqueue[0]?.ref_no ?? "Ikman batch",
      summary: `Imported ${parsedCount} refs, sent ${toEnqueue.length} to owners`,
      details: {
        refs: toEnqueue.map((r) => r.ref_no),
        skipped,
        include: toEnqueue.length,
      },
    });

    revalidateIkman();
    return { batchId: batch.id, enqueued: toEnqueue.length, skipped };
  });
}

export async function decideIkmanItem(
  itemId: string,
  decision: "approve" | "decline",
  note?: string,
): Promise<ActionResult> {
  return toResult(async () => {
    const profile = await requireProfile();
    const supabase = await createClient();

    const { data: item, error } = await supabase
      .from("ikman_republish_items")
      .select("id, ref_no, status, owner_id, owner_name")
      .eq("id", itemId)
      .maybeSingle();
    if (error || !item) throw new Error(error?.message || "Request not found.");
    if (item.status !== "pending_owner") throw new Error("This request is no longer waiting on a decision.");

    const isOwner =
      item.owner_id === profile.id || item.owner_name === profile.display_name;
    if (profile.role !== "Admin" && !isOwner) {
      throw new Error("Only the listing owner can decide this.");
    }

    const nextStatus: IkmanItemStatus =
      decision === "approve" ? "approved_by_owner" : "declined_by_owner";

    const { error: updErr } = await supabase
      .from("ikman_republish_items")
      .update({
        status: nextStatus,
        owner_decided_at: new Date().toISOString(),
        owner_note: note?.trim() || null,
        // Indefinite suppress when declined (cleared on Admin force re-ask).
        suppressed_until: decision === "decline" ? null : null,
      })
      .eq("id", itemId)
      .eq("status", "pending_owner");
    if (updErr) throw new Error(updErr.message);

    await logAudit({
      category: "queue",
      action: decision === "approve" ? "ikman_republish_approved" : "ikman_republish_declined",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectLabel: item.ref_no,
      summary:
        decision === "approve"
          ? `Approved Ikman republish for ${item.ref_no}`
          : `Declined Ikman republish for ${item.ref_no}`,
      details: { note: note?.trim() || null },
    });

    revalidateIkman();
  });
}

export async function markIkmanRepublished(itemIds: string[]): Promise<ActionResult<{ count: number }>> {
  return toResult(async () => {
    const profile = await requireAdmin();
    const ids = [...new Set(itemIds.filter(Boolean))];
    if (!ids.length) throw new Error("Select at least one listing.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ikman_republish_items")
      .update({
        status: "republished",
        admin_completed_at: new Date().toISOString(),
        admin_completed_by: profile.id,
        admin_completed_by_name: profile.display_name,
      })
      .in("id", ids)
      .eq("status", "approved_by_owner")
      .select("id, ref_no");
    if (error) throw new Error(error.message);

    const count = data?.length ?? 0;
    const refs = (data ?? []).map((r) => r.ref_no);
    await logAudit({
      category: "queue",
      action: "ikman_republish_completed",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectLabel: refs[0] ?? null,
      summary:
        count === 1
          ? `Marked ${refs[0]} republished on Ikman`
          : `Marked ${count} listing(s) republished on Ikman`,
      details: { refs },
    });

    revalidateIkman();
    return { count };
  });
}

export async function forceReaskIkmanItem(itemId: string): Promise<ActionResult> {
  return toResult(async () => {
    const profile = await requireAdmin();
    const supabase = await createClient();

    const { data: item, error } = await supabase
      .from("ikman_republish_items")
      .select("id, ref_no, status, property_id, owner_id, owner_name")
      .eq("id", itemId)
      .maybeSingle();
    if (error || !item) throw new Error(error?.message || "Item not found.");
    if (item.status !== "declined_by_owner") {
      throw new Error("Only declined items can be force re-asked.");
    }

    const { data: open } = await supabase
      .from("ikman_republish_items")
      .select("id")
      .eq("ref_no", item.ref_no)
      .in("status", ["pending_owner", "approved_by_owner"])
      .maybeSingle();
    if (open) throw new Error("This listing already has an open Ikman request.");

    await supabase
      .from("ikman_republish_items")
      .update({ status: "cancelled", suppressed_until: null })
      .eq("id", item.id);

    const { data: batch, error: batchErr } = await supabase
      .from("ikman_republish_batches")
      .insert({
        created_by: profile.id,
        created_by_name: profile.display_name,
        raw_text: null,
        parsed_ref_count: 1,
        enqueued_count: 1,
        skipped_count: 0,
        notes: `Force re-ask for ${item.ref_no}`,
      })
      .select("id")
      .single();
    if (batchErr || !batch) throw new Error(batchErr?.message || "Could not create batch.");

    const { error: insErr } = await supabase.from("ikman_republish_items").insert({
      batch_id: batch.id,
      ref_no: item.ref_no,
      property_id: item.property_id,
      owner_id: item.owner_id,
      owner_name: item.owner_name,
      status: "pending_owner",
    });
    if (insErr) throw new Error(insErr.message);

    await logAudit({
      category: "queue",
      action: "ikman_republish_force_reask",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property",
      subjectLabel: item.ref_no,
      summary: `Force re-asked Ikman republish for ${item.ref_no}`,
    });

    revalidateIkman();
  });
}

export type IkmanListItem = {
  id: string;
  ref_no: string;
  status: IkmanItemStatus;
  owner_id: string | null;
  owner_name: string | null;
  owner_note: string | null;
  owner_decided_at: string | null;
  created_at: string;
  updated_at: string | null;
  batch_id: string | null;
  admin_completed_at: string | null;
  admin_completed_by_name: string | null;
  property_type: string | null;
  opportunity_type: string | null;
  city: string | null;
  listing_status: string | null;
};

export type IkmanBatchRow = {
  id: string;
  created_at: string;
  created_by_name: string | null;
  parsed_ref_count: number;
  enqueued_count: number;
  skipped_count: number;
  notes: string | null;
};

export type IkmanAuditEvent = {
  id: string | number;
  occurred_at: string;
  action: string;
  actor_name: string | null;
  subject_label: string | null;
  summary: string | null;
  details: unknown;
};

export type IkmanHistoryResult = {
  items: IkmanListItem[];
  batches: IkmanBatchRow[];
  events: IkmanAuditEvent[];
  total: number;
  eventsTotal: number;
  statusCounts: Record<IkmanItemStatus, number>;
};

export async function listIkmanItems(
  status: IkmanItemStatus | IkmanItemStatus[],
  opts?: { ownerOnly?: boolean },
): Promise<IkmanListItem[]> {
  const profile = await requireProfile();
  const statuses = Array.isArray(status) ? status : [status];
  const supabase = await createClient();
  // Disambiguate: items have FKs on both property_id and ref_no.
  const select =
    "id, ref_no, status, owner_id, owner_name, owner_note, owner_decided_at, created_at, updated_at, batch_id, admin_completed_at, admin_completed_by_name, property:properties!property_id(property_type, opportunity_type, city, status)";

  if (opts?.ownerOnly || profile.role !== "Admin") {
    // Match RLS: owner_id OR owner_name (name match is not limited to null owner_id).
    const [{ data: byId }, { data: byName }] = await Promise.all([
      supabase
        .from("ikman_republish_items")
        .select(select)
        .in("status", statuses)
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("ikman_republish_items")
        .select(select)
        .in("status", statuses)
        .eq("owner_name", profile.display_name)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const merged = [...(byId ?? []), ...(byName ?? [])];
    const seen = new Set<string>();
    return merged
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(mapListItem);
  }

  const { data, error } = await supabase
    .from("ikman_republish_items")
    .select(select)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapListItem);
}

function mapListItem(row: {
  id: string;
  ref_no: string;
  status: IkmanItemStatus;
  owner_id: string | null;
  owner_name: string | null;
  owner_note: string | null;
  owner_decided_at: string | null;
  created_at: string;
  updated_at?: string | null;
  batch_id?: string | null;
  admin_completed_at?: string | null;
  admin_completed_by_name?: string | null;
  property:
    | {
        property_type: string | null;
        opportunity_type: string | null;
        city: string | null;
        status: string | null;
      }
    | {
        property_type: string | null;
        opportunity_type: string | null;
        city: string | null;
        status: string | null;
      }[]
    | null;
}): IkmanListItem {
  const property = Array.isArray(row.property) ? row.property[0] : row.property;
  return {
    id: row.id,
    ref_no: row.ref_no,
    status: row.status,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    owner_note: row.owner_note,
    owner_decided_at: row.owner_decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    batch_id: row.batch_id ?? null,
    admin_completed_at: row.admin_completed_at ?? null,
    admin_completed_by_name: row.admin_completed_by_name ?? null,
    property_type: property?.property_type ?? null,
    opportunity_type: property?.opportunity_type ?? null,
    city: property?.city ?? null,
    listing_status: property?.status ?? null,
  };
}

const IKMAN_AUDIT_ACTIONS = [
  "ikman_republish_batch",
  "ikman_republish_approved",
  "ikman_republish_declined",
  "ikman_republish_completed",
  "ikman_republish_force_reask",
] as const;

/** Full history for Admin analysis: all item statuses + import batches + audit actions. */
export async function loadIkmanHistory(opts: {
  status?: string;
  q?: string;
  page?: number;
  eventsPage?: number;
  pageSize?: number;
}): Promise<IkmanHistoryResult> {
  await requireAdmin();
  const supabase = await createClient();
  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(1, opts.page ?? 1);
  const eventsPage = Math.max(1, opts.eventsPage ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const eventsFrom = (eventsPage - 1) * pageSize;
  const eventsTo = eventsFrom + pageSize - 1;
  const q = (opts.q ?? "").replace(/[%_,()"\\]/g, " ").trim();
  const status = opts.status?.trim() as IkmanItemStatus | "" | undefined;
  const statusFilter =
    status && IKMAN_ITEM_STATUSES.includes(status as IkmanItemStatus)
      ? (status as IkmanItemStatus)
      : null;

  const select =
    "id, ref_no, status, owner_id, owner_name, owner_note, owner_decided_at, created_at, updated_at, batch_id, admin_completed_at, admin_completed_by_name, property:properties!property_id(property_type, opportunity_type, city, status)";

  let itemsQuery = supabase
    .from("ikman_republish_items")
    .select(select, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (statusFilter) itemsQuery = itemsQuery.eq("status", statusFilter);
  if (q) {
    itemsQuery = itemsQuery.or(
      `ref_no.ilike.%${q}%,owner_name.ilike.%${q}%,owner_note.ilike.%${q}%,admin_completed_by_name.ilike.%${q}%`,
    );
  }

  let eventsQuery = supabase
    .from("audit_log")
    .select(
      "id, occurred_at, action, actor_name, subject_label, summary, details",
      { count: "exact" },
    )
    .in("action", [...IKMAN_AUDIT_ACTIONS])
    .order("occurred_at", { ascending: false })
    .range(eventsFrom, eventsTo);
  if (q) {
    eventsQuery = eventsQuery.or(
      `actor_name.ilike.%${q}%,subject_label.ilike.%${q}%,summary.ilike.%${q}%,action.ilike.%${q}%`,
    );
  }

  const countQueries = IKMAN_ITEM_STATUSES.map((s) =>
    supabase
      .from("ikman_republish_items")
      .select("id", { count: "exact", head: true })
      .eq("status", s)
      .then((r) => [s, r.count ?? 0] as const),
  );

  const [itemsRes, batchesRes, eventsRes, ...statusPairs] = await Promise.all([
    itemsQuery,
    supabase
      .from("ikman_republish_batches")
      .select(
        "id, created_at, created_by_name, parsed_ref_count, enqueued_count, skipped_count, notes",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    eventsQuery,
    ...countQueries,
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (batchesRes.error) throw new Error(batchesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const statusCounts = Object.fromEntries(statusPairs) as Record<IkmanItemStatus, number>;

  return {
    items: (itemsRes.data ?? []).map(mapListItem),
    batches: (batchesRes.data ?? []) as IkmanBatchRow[],
    events: (eventsRes.data ?? []) as IkmanAuditEvent[],
    total: itemsRes.count ?? 0,
    eventsTotal: eventsRes.count ?? 0,
    statusCounts,
  };
}

export async function countIkmanQueues(): Promise<{
  pendingOwner: number;
  readyAdmin: number;
  myPending: number;
}> {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (profile.role === "Admin") {
    const [owner, ready, mine] = await Promise.all([
      supabase
        .from("ikman_republish_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_owner"),
      supabase
        .from("ikman_republish_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved_by_owner"),
      supabase
        .from("ikman_republish_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_owner")
        .eq("owner_id", profile.id),
    ]);
    return {
      pendingOwner: owner.count ?? 0,
      readyAdmin: ready.count ?? 0,
      myPending: mine.count ?? 0,
    };
  }

  // Deduped count: fetch ids matched by owner_id or owner_name.
  const [{ data: byId }, { data: byName }] = await Promise.all([
    supabase
      .from("ikman_republish_items")
      .select("id")
      .eq("status", "pending_owner")
      .eq("owner_id", profile.id)
      .limit(500),
    supabase
      .from("ikman_republish_items")
      .select("id")
      .eq("status", "pending_owner")
      .eq("owner_name", profile.display_name)
      .limit(500),
  ]);
  const seen = new Set<string>();
  for (const row of [...(byId ?? []), ...(byName ?? [])]) seen.add(row.id);

  return {
    pendingOwner: 0,
    readyAdmin: 0,
    myPending: seen.size,
  };
}
