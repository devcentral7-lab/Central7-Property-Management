"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toResult, type ActionResult } from "@/lib/action-result";
import {
  type AmenityOption,
  defaultAmenityCategory,
  parseAmenityCategory,
} from "@/lib/amenity-category";
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

function normalizeAmenityOptions(
  raw: Array<string | AmenityOption | { name?: string; category?: string }>,
): AmenityOption[] {
  const seen = new Set<string>();
  const out: AmenityOption[] = [];
  for (const item of raw) {
    const name =
      typeof item === "string"
        ? item.trim()
        : String(item?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const category =
      typeof item === "string"
        ? defaultAmenityCategory(name)
        : item.category != null
          ? parseAmenityCategory(item.category)
          : defaultAmenityCategory(name);
    out.push({ name, category });
  }
  return out;
}

export async function saveFormList(
  key: string,
  items: string[] | AmenityOption[],
): Promise<ActionResult> {
  return toResult(() => writeFormList(key, items));
}

async function writeFormList(
  key: string,
  items: string[] | AmenityOption[],
) {
  await requireAdmin();
  if (!(FORM_LIST_KEYS as readonly string[]).includes(key)) {
    throw new Error("Unknown list");
  }

  const isAmenities = key === "amenities_list";
  const payload = isAmenities
    ? normalizeAmenityOptions(items as AmenityOption[])
    : normalizeItems(items as string[]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_form_list", {
    p_key: key as FormListKey,
    p_items: payload,
  });
  if (error) throw error;

  await logAudit({
    category: "settings",
    action: "form_list_update",
    subjectType: "form_list",
    subjectId: key,
    subjectLabel: key,
    summary: `Updated form list “${key}” (${payload.length} items)`,
    details: { key, item_count: payload.length, items: payload },
  });

  revalidatePath("/app/listings");
  revalidatePath("/app/properties");
  revalidatePath("/app/activity");
  revalidatePath("/search");
  revalidatePath("/app");
}
