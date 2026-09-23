"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  FORM_LIST_KEYS,
  type FormListKey,
} from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

function requireAdmin() {
  return requireProfile().then((p) => {
    if (p.role !== "Admin") throw new Error("Admin only");
    return p;
  });
}

function normalizeItems(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const t = item.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function saveFormList(key: string, items: string[]) {
  await requireAdmin();
  if (!(FORM_LIST_KEYS as readonly string[]).includes(key)) {
    throw new Error("Unknown list");
  }
  const cleaned = normalizeItems(items);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_form_list", {
    p_key: key as FormListKey,
    p_items: cleaned,
  });
  if (error) throw error;

  await logAudit({
    category: "settings",
    action: "form_list_update",
    subjectType: "form_list",
    subjectId: key,
    subjectLabel: key,
    summary: `Updated form list “${key}” (${cleaned.length} items)`,
    details: { key, item_count: cleaned.length, items: cleaned },
  });

  revalidatePath("/app/listings");
  revalidatePath("/app/properties");
  revalidatePath("/app/activity");
  revalidatePath("/search");
  revalidatePath("/app");
}
