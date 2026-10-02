"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ComplexListItem = {
  id: string;
  name: string;
  location: string | null;
  address: string | null;
  built_year: number | null;
  developer: string | null;
  apartments_per_floor: number | null;
  amenities: string[];
  notes: string | null;
  added_by: string | null;
  created_at: string;
  listing_count: number;
};

export type ComplexListing = {
  ref_no: string;
  property_type: string | null;
  opportunity_type: string | null;
  status: string;
  price_total: number | null;
  currency: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

const PAGE = 1000;

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") throw new Error("Admin only");
  return profile;
}

function intOrNull(raw: string, label: string, min: number, max: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

function parseFields(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("Name is required.");
  const amenities = [
    ...new Set(
      String(formData.get("amenities") ?? "")
        .split(/[\n,]/)
        .map((a) => a.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ];
  return {
    name,
    location: str(formData.get("location")) || null,
    address: str(formData.get("address")) || null,
    developer: str(formData.get("developer")) || null,
    built_year: intOrNull(str(formData.get("built_year")), "Built year", 1900, new Date().getFullYear() + 10),
    apartments_per_floor: intOrNull(str(formData.get("apartments_per_floor")), "Apartments per floor", 1, 500),
    amenities,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

function friendlyError(message: string): string {
  return /duplicate key|unique/i.test(message) ? "A complex with this name already exists." : message;
}

export async function listComplexes(): Promise<ComplexListItem[]> {
  await requireProfile();
  const admin = await createClient();
  const [complexes, links] = await Promise.all([
    admin
      .from("apartment_complexes")
      .select(
        "id, name, location, address, built_year, developer, apartments_per_floor, amenities, notes, added_by, created_at",
      )
      .order("name"),
    (async () => {
      const ids: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
          .from("properties")
          .select("apartment_complex_id")
          .not("apartment_complex_id", "is", null)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        ids.push(...(data ?? []).map((r) => r.apartment_complex_id as string));
        if (!data || data.length < PAGE) return ids;
      }
    })(),
  ]);
  if (complexes.error) throw complexes.error;
  const counts = new Map<string, number>();
  for (const id of links) counts.set(id, (counts.get(id) ?? 0) + 1);
  return (complexes.data ?? []).map((c) => ({
    ...(c as Omit<ComplexListItem, "listing_count">),
    amenities: (c.amenities as string[] | null) ?? [],
    listing_count: counts.get(c.id as string) ?? 0,
  }));
}

export async function listComplexListings(
  complexId: string,
): Promise<{ ok: true; rows: ComplexListing[] } | { ok: false; error: string }> {
  try {
    await requireProfile();
    const client = await createClient();
    const { data, error } = await client
      .from("properties")
      .select("ref_no, property_type, opportunity_type, status, price_total, currency")
      .eq("apartment_complex_id", complexId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: (data ?? []) as ComplexListing[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createComplex(formData: FormData): Promise<Result> {
  try {
    const profile = await requireAdmin();
    const fields = parseFields(formData);
    const { data, error } = await createAdminClient()
      .from("apartment_complexes")
      .insert({ ...fields, added_by: profile.display_name })
      .select("id")
      .single();
    if (error) return { ok: false, error: friendlyError(error.message) };

    revalidatePath("/app/complexes");
    await logAudit({
      category: "settings",
      action: "create",
      subjectType: "apartment_complex",
      subjectId: data.id as string,
      subjectLabel: fields.name,
      summary: `Added apartment complex ${fields.name}`,
      details: { location: fields.location },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updateComplex(formData: FormData): Promise<Result> {
  try {
    await requireAdmin();
    const id = str(formData.get("complex_id"));
    if (!id) return { ok: false, error: "Missing complex id." };
    const fields = parseFields(formData);
    const admin = createAdminClient();
    const { data: before } = await admin.from("apartment_complexes").select("name").eq("id", id).single();
    const { error } = await admin.from("apartment_complexes").update(fields).eq("id", id);
    if (error) return { ok: false, error: friendlyError(error.message) };

    revalidatePath("/app/complexes");
    await logAudit({
      category: "settings",
      action: "update",
      subjectType: "apartment_complex",
      subjectId: id,
      subjectLabel: fields.name,
      summary:
        before?.name && before.name !== fields.name
          ? `Renamed apartment complex ${before.name} to ${fields.name}`
          : `Updated apartment complex ${fields.name}`,
      details: { location: fields.location },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Deletes a complex; its listings move to `moveToId` or are left without a complex. */
export async function deleteComplex(complexId: string, moveToId: string | null): Promise<Result> {
  try {
    await requireAdmin();
    if (moveToId === complexId) return { ok: false, error: "Pick a different complex to move listings to." };
    const admin = createAdminClient();
    const { data: complex, error: getErr } = await admin
      .from("apartment_complexes")
      .select("name")
      .eq("id", complexId)
      .single();
    if (getErr || !complex) return { ok: false, error: getErr?.message || "Complex not found." };

    let moved = 0;
    let target: string | null = null;
    if (moveToId) {
      const { data: to, error: toErr } = await admin
        .from("apartment_complexes")
        .select("name")
        .eq("id", moveToId)
        .single();
      if (toErr || !to) return { ok: false, error: "The complex to move listings to was not found." };
      target = to.name as string;
      const { data: updated, error: moveErr } = await admin
        .from("properties")
        .update({ apartment_complex_id: moveToId })
        .eq("apartment_complex_id", complexId)
        .select("id");
      if (moveErr) return { ok: false, error: moveErr.message };
      moved = updated?.length ?? 0;
    }

    const { error } = await admin.from("apartment_complexes").delete().eq("id", complexId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/app/complexes");
    await logAudit({
      category: "settings",
      action: "delete",
      subjectType: "apartment_complex",
      subjectId: complexId,
      subjectLabel: complex.name as string,
      summary: target
        ? `Deleted apartment complex ${complex.name}; moved ${moved} listing(s) to ${target}`
        : `Deleted apartment complex ${complex.name}`,
      details: { moved_to: target, moved },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
