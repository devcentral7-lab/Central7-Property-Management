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
  coc: string | null;
  deed: string | null;
  lifts: number | null;
  towers_wings: number | null;
  tower_wing_name: string | null;
  apartment_types: string[];
  service_lift: string | null;
  swimming_pools_count: number | null;
  swimming_pools_floor: string | null;
  gym_floor: string | null;
  generator: string | null;
  guard_room: string | null;
  common_hall: string | null;
  drivers_washroom: string | null;
  maids_washroom: string | null;
  contact_management: string | null;
  contact_security: string | null;
  parking_type: string | null;
  parking_floors: string | null;
  parking_lift: string | null;
  number_of_floors: number | null;
  maintenance_charges: string | null;
  maintenance_type: string | null;
  maintenance_company: string | null;
  google_pin: string | null;
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

const COMPLEX_SELECT = [
  "id",
  "name",
  "location",
  "address",
  "built_year",
  "developer",
  "apartments_per_floor",
  "amenities",
  "notes",
  "coc",
  "deed",
  "lifts",
  "towers_wings",
  "tower_wing_name",
  "apartment_types",
  "service_lift",
  "swimming_pools_count",
  "swimming_pools_floor",
  "gym_floor",
  "generator",
  "guard_room",
  "common_hall",
  "drivers_washroom",
  "maids_washroom",
  "contact_management",
  "contact_security",
  "parking_type",
  "parking_floors",
  "parking_lift",
  "number_of_floors",
  "maintenance_charges",
  "maintenance_type",
  "maintenance_company",
  "google_pin",
  "added_by",
  "created_at",
].join(", ");

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
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
    ...new Set([
      ...formData
        .getAll("amenity")
        .map((v) => String(v).trim().replace(/\s+/g, " "))
        .filter(Boolean),
      ...String(formData.get("amenities") ?? "")
        .split(/[\n,]/)
        .map((a) => a.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ]),
  ];
  const maintenanceType = str(formData.get("maintenance_type")) || null;
  return {
    name,
    location: str(formData.get("location")) || null,
    address: str(formData.get("address")) || null,
    developer: str(formData.get("developer")) || null,
    built_year: intOrNull(str(formData.get("built_year")), "Built year", 1900, new Date().getFullYear() + 10),
    apartments_per_floor: intOrNull(str(formData.get("apartments_per_floor")), "Apartments per floor", 1, 500),
    amenities,
    notes: String(formData.get("notes") ?? "").trim() || null,
    coc: str(formData.get("coc")) || null,
    deed: str(formData.get("deed")) || null,
    lifts: intOrNull(str(formData.get("lifts")), "Lifts", 1, 3),
    towers_wings: intOrNull(str(formData.get("towers_wings")), "Towers / Wings", 1, 100),
    tower_wing_name:
      [
        ...new Set(
          formData
            .getAll("tower_wing_name")
            .map((v) => String(v ?? "").trim().replace(/\s+/g, " "))
            .filter(Boolean),
        ),
      ].join(" · ") || null,
    apartment_types: [
      ...new Set(
        String(formData.get("apartment_types") ?? "")
          .split(/[\n,]/)
          .map((t) => t.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ),
    ],
    service_lift: str(formData.get("service_lift")) || null,
    swimming_pools_count: intOrNull(str(formData.get("swimming_pools_count")), "Swimming pools", 0, 50),
    swimming_pools_floor: str(formData.get("swimming_pools_floor")) || null,
    gym_floor: str(formData.get("gym_floor")) || null,
    generator: str(formData.get("generator")) || null,
    guard_room: str(formData.get("guard_room")) || null,
    common_hall: str(formData.get("common_hall")) || null,
    drivers_washroom: str(formData.get("drivers_washroom")) || null,
    maids_washroom: str(formData.get("maids_washroom")) || null,
    contact_management: str(formData.get("contact_management")) || null,
    contact_security: str(formData.get("contact_security")) || null,
    parking_type: str(formData.get("parking_type")) || null,
    parking_floors: str(formData.get("parking_floors")) || null,
    parking_lift: str(formData.get("parking_lift")) || null,
    number_of_floors: intOrNull(str(formData.get("number_of_floors")), "No of floors", 1, 200),
    maintenance_charges: str(formData.get("maintenance_charges")) || null,
    maintenance_type: maintenanceType,
    maintenance_company:
      maintenanceType === "Outsourced" ? str(formData.get("maintenance_company")) || null : null,
    google_pin: str(formData.get("google_pin")) || null,
  };
}

function friendlyError(message: string): string {
  return /duplicate key|unique/i.test(message) ? "A complex with this name already exists." : message;
}

export async function listComplexes(): Promise<ComplexListItem[]> {
  await requireProfile();
  const admin = await createClient();
  const [complexes, links] = await Promise.all([
    admin.from("apartment_complexes").select(COMPLEX_SELECT).order("name"),
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
  const rows = (complexes.data ?? []) as unknown as Omit<ComplexListItem, "listing_count">[];
  return rows.map((c) => ({
    ...c,
    amenities: c.amenities ?? [],
    apartment_types: c.apartment_types ?? [],
    listing_count: counts.get(c.id) ?? 0,
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
    const profile = await requireProfile();
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
    await requireProfile();
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
    await requireProfile();
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
