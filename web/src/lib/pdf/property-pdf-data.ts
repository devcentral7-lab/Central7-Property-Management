import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY } from "@/lib/company";
import { downloadPhoto, isDriveConfigured, listPropertyPhotos } from "@/lib/drive/photos";
import { resizeToJpeg } from "@/lib/drive/resize";
import { withSavedOrder } from "@/lib/drive/saved-order";
import type { Profile } from "@/lib/types";
import { typeSpecificKeys } from "@/lib/property-fields";
import { createClient } from "@/lib/supabase/server";

/** "client" is Central7-branded for buyers/tenants; "agent" is unbranded property data only. */
export type PdfCopy = "client" | "agent";

export type PdfField = { label: string; value: string };

export type GlanceIcon = "area" | "land" | "bed" | "bath" | "floors" | "parking";

export type PdfAmenity = { name: string };

export type PdfPhoto = { data: Buffer; format: "jpg" | "png" };

export type PropertyPdfData = {
  copy: PdfCopy;
  refNo: string;
  eyebrow: string;
  heading: string;
  priceLabel: string;
  price: string | null;
  priceSuffix: string | null;
  priceNote: string | null;
  glance: (PdfField & { icon: GlanceIcon })[];
  details: PdfField[];
  amenities: PdfAmenity[];
  description: string | null;
  contact: { name: string; phone: string };
  company: typeof COMPANY;
  photos: PdfPhoto[];
  generatedAt: string;
};

const TZ = "Asia/Colombo";
const MAX_PHOTOS = 8;

function has(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return Boolean(v.trim());
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(v);
}

function money(v: unknown, currency: string): string | null {
  if (!has(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return `${currency} ${String(v)}`;
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function isRent(opportunity: string) {
  return /rent|lease/i.test(opportunity);
}

function amenityName(raw: string) {
  return raw.replace(/\s*\(room for games\)/i, "").trim();
}

/** Downscaled so eight photos stay well under Vercel's 4.5 MB response limit. */
const PDF_PHOTO_EDGE = 1400;

async function pdfPhoto(fileId: string): Promise<PdfPhoto> {
  const { buffer, mimeType } = await downloadPhoto(fileId);
  try {
    return { data: await resizeToJpeg(buffer, PDF_PHOTO_EDGE, 72), format: "jpg" };
  } catch (e) {
    if (/webp/i.test(mimeType)) throw e;
    return { data: buffer, format: /png/i.test(mimeType) ? "png" : "jpg" };
  }
}

async function loadPhotos(
  supabase: SupabaseClient,
  propertyId: string,
  refNo: string,
): Promise<PdfPhoto[]> {
  if (!isDriveConfigured()) return [];
  try {
    const ordered = await withSavedOrder(supabase, propertyId, await listPropertyPhotos(refNo));
    const list = ordered.filter((p) => /jpe?g|png|webp/i.test(p.mimeType)).slice(0, MAX_PHOTOS);
    const settled = await Promise.allSettled(list.map((p) => pdfPhoto(p.id)));
    return settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  } catch {
    return [];
  }
}

export async function loadPropertyPdfData(
  refNoRaw: string,
  copy: PdfCopy,
  profile: Profile,
): Promise<PropertyPdfData | null> {
  const refNo = decodeURIComponent(refNoRaw).toUpperCase();
  const supabase = await createClient();

  const { data: p, error } = await supabase
    .from("properties")
    .select("*")
    .eq("ref_no", refNo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return null;

  const [{ data: complex }, photos] = await Promise.all([
    p.apartment_complex_id
      ? supabase
          .from("apartment_complexes")
          .select("name, amenities")
          .eq("id", p.apartment_complex_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string; amenities: string[] | null } | null }),
    loadPhotos(supabase, p.id, p.ref_no),
  ]);

  const propertyType = String(p.property_type || "Property");
  const opportunity = String(p.opportunity_type || "");
  const rent = isRent(opportunity);
  const currency = String(p.currency || "LKR");
  const isLand = propertyType === "Land";
  const isApartment = propertyType === "Apartment";
  const allowed = typeSpecificKeys(propertyType);
  const attrs = (p.type_attributes || {}) as Record<string, unknown>;
  const pick = (key: string, value: unknown) => allowed.has(key) && has(value);
  const complexName = isApartment && has(complex?.name) ? String(complex!.name) : null;

  const glance: PropertyPdfData["glance"] = [];
  if (pick("floor_area_sqft", p.floor_area_sqft))
    glance.push({ icon: "area", label: "Sq.ft", value: num(p.floor_area_sqft) });
  if (pick("land_size_perch", p.land_size_perch))
    glance.push({ icon: "land", label: "Perches", value: num(p.land_size_perch) });
  if (pick("bedrooms", p.bedrooms)) glance.push({ icon: "bed", label: "Bedrooms", value: num(p.bedrooms) });
  if (pick("bathrooms", p.bathrooms))
    glance.push({ icon: "bath", label: "Bathrooms", value: num(p.bathrooms) });
  if (pick("number_of_floors", p.number_of_floors))
    glance.push({ icon: "floors", label: "Floors", value: num(p.number_of_floors) });
  if (pick("parking_spaces", p.parking_spaces))
    glance.push({ icon: "parking", label: "Parking", value: num(p.parking_spaces) });

  const details: PdfField[] = [];
  const add = (label: string, value: unknown, ok = has(value)) => {
    if (ok) details.push({ label, value: String(value) });
  };
  add("Apartment name", complexName);
  add("Property type", propertyType);
  add("Sub-type", p.property_subtype);
  add("Location", p.city);
  add("Furnishing", p.furnished);
  add("Bedrooms", p.bedrooms, pick("bedrooms", p.bedrooms));
  add("Bathrooms", p.bathrooms, pick("bathrooms", p.bathrooms));
  add("Floor", p.apartment_floor, pick("apartment_floor", p.apartment_floor));
  add("Floors", p.number_of_floors, pick("number_of_floors", p.number_of_floors));
  add("Parking", p.parking_spaces, pick("parking_spaces", p.parking_spaces));
  add("View", p.view, pick("view", p.view));
  add(
    "Floor area",
    has(p.floor_area_sqft) ? `${num(p.floor_area_sqft)} sq.ft` : null,
    pick("floor_area_sqft", p.floor_area_sqft),
  );
  add(
    "Land size",
    has(p.land_size_perch) ? `${num(p.land_size_perch)} perches` : null,
    pick("land_size_perch", p.land_size_perch),
  );
  add("Built-up area", attrs.built_up_area, pick("built_up_area", attrs.built_up_area));
  add("Suitable for", attrs.suitable_for, pick("suitable_for", attrs.suitable_for));
  add("Purpose", p.purpose, allowed.has("purpose") && has(p.purpose));
  add("Age", has(p.age_years) ? `${num(p.age_years)} years` : null, pick("age_years", p.age_years));
  add("Price per perch", money(p.price_per_perch, currency));
  if (!isLand) add("Price per sq.ft", money(p.price_per_sqft, currency));
  if (copy === "client") add("Listing type", p.contact_type);

  const seen = new Set<string>();
  const amenities: PdfAmenity[] = [];
  for (const raw of [...((p.amenities || []) as string[]), ...((complex?.amenities || []) as string[])]) {
    const name = amenityName(String(raw || ""));
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    amenities.push({ name });
  }

  const priceNote = rent
    ? null
    : isLand || !has(p.price_per_sqft)
      ? has(p.price_per_perch)
        ? `${money(p.price_per_perch, currency)} per perch`
        : null
      : `${money(p.price_per_sqft, currency)} per sq.ft`;

  const place = [complexName, p.city].filter(has).join(", ");

  return {
    copy,
    refNo: p.ref_no,
    eyebrow: `${propertyType} for ${rent ? "rent" : "sale"}${place ? " in" : ""}`,
    heading: place || propertyType,
    priceLabel: rent ? "Monthly rent" : "Asking price",
    price: money(p.price_total, currency),
    priceSuffix: rent ? "/ month" : null,
    priceNote,
    glance,
    details,
    amenities,
    description: has(p.comments) ? String(p.comments).trim() : null,
    contact: {
      name: profile.display_name,
      phone: has(profile.mobile_number) ? String(profile.mobile_number) : COMPANY.phone,
    },
    company: COMPANY,
    photos,
    generatedAt: new Date().toLocaleDateString("en-GB", {
      timeZone: TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}
