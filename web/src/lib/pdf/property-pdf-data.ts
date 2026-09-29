import { COMPANY } from "@/lib/company";
import { downloadPhoto, isDriveConfigured, listPropertyPhotos } from "@/lib/drive/photos";
import type { Profile } from "@/lib/types";
import { typeSpecificKeys } from "@/lib/property-fields";
import { createClient } from "@/lib/supabase/server";

/** "client" is safe to hand to buyers/tenants; "full" is for staff only. */
export type PdfCopy = "client" | "full";

export type PdfField = { label: string; value: string };

export type GlanceIcon = "area" | "land" | "bed" | "bath" | "floors" | "parking";

export type PdfAmenity = { name: string; note: string | null };

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
  owner: PdfField[];
  internal: PdfField[];
  internalComments: string | null;
  contact: { name: string; phone: string };
  company: typeof COMPANY;
  photos: PdfPhoto[];
  generatedAt: string;
};

const TZ = "Asia/Colombo";
const MAX_PHOTOS = 8;

const AMENITY_NOTES: Record<string, string> = {
  "swimming pool": "Refreshing on-site pool",
  rooftop: "Open rooftop access",
  "rooftop garden": "Landscaped rooftop garden",
  "rumpus room (room for games)": "Games & recreation room",
  gym: "Fitness & wellness",
  "garden space": "Private green space",
  "maids room": "Dedicated staff room",
  "maids toilet": "Separate staff washroom",
  "bar area": "Entertainment & bar area",
  "servant quarters": "Separate staff living space",
  "solar panels": "Energy-saving solar power",
  generator: "Power backup",
  cctv: "24/7 security surveillance",
  "lift/elevator": "Lift access",
  balcony: "Private outdoor balcony",
  garage: "Covered vehicle parking",
  "study room": "Quiet work & study space",
  "store room": "Extra storage space",
  "air conditioning": "Climate-controlled comfort",
  ac: "Climate-controlled comfort",
  "sea view": "Scenic ocean views",
  "water tank": "Reliable water storage",
};

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

async function loadPhotos(refNo: string): Promise<PdfPhoto[]> {
  if (!isDriveConfigured()) return [];
  try {
    const list = (await listPropertyPhotos(refNo))
      .filter((p) => /jpe?g|png/i.test(p.mimeType))
      .slice(0, MAX_PHOTOS);
    const settled = await Promise.allSettled(list.map((p) => downloadPhoto(p.id)));
    return settled.flatMap((r) =>
      r.status === "fulfilled"
        ? [{ data: r.value.buffer, format: /png/i.test(r.value.mimeType) ? "png" : "jpg" } as PdfPhoto]
        : [],
    );
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

  const [{ data: complex }, { data: coords }, photos] = await Promise.all([
    p.apartment_complex_id
      ? supabase
          .from("apartment_complexes")
          .select("name, amenities")
          .eq("id", p.apartment_complex_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string; amenities: string[] | null } | null }),
    copy === "full"
      ? supabase.rpc("get_property_location", { p_property_id: p.id })
      : Promise.resolve({ data: null }),
    loadPhotos(p.ref_no),
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
  if (copy === "full") add("Address", p.address);
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
  add("Listing type", p.contact_type);

  const seen = new Set<string>();
  const amenities: PdfAmenity[] = [];
  for (const raw of [...((p.amenities || []) as string[]), ...((complex?.amenities || []) as string[])]) {
    const name = amenityName(String(raw || ""));
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    amenities.push({ name, note: AMENITY_NOTES[String(raw).trim().toLowerCase()] ?? AMENITY_NOTES[key] ?? null });
  }

  const owner: PdfField[] = [];
  const internal: PdfField[] = [];
  if (copy === "full") {
    const pushTo = (list: PdfField[], label: string, value: unknown) => {
      if (has(value)) list.push({ label, value: String(value) });
    };
    pushTo(owner, "Owner / contact", p.contact_name);
    pushTo(owner, "Phone 1", p.contact_phone_1);
    pushTo(owner, "Phone 2", p.contact_phone_2);
    pushTo(owner, "Email", p.contact_email);

    const coord = Array.isArray(coords) ? coords[0] : coords;
    pushTo(internal, "Status", p.status);
    if (!isLand) pushTo(internal, "Budget", money(p.budget, currency));
    if (coord?.lat != null && coord?.lng != null) {
      pushTo(internal, "Coordinates", `${coord.lat}, ${coord.lng}`);
    }
    pushTo(internal, "Do not publish", p.do_not_publish ? "Yes" : null);
    pushTo(internal, "Created by", p.created_by_name);
    pushTo(
      internal,
      "Created",
      p.created_at ? new Date(p.created_at).toLocaleString("en-GB", { timeZone: TZ }) : null,
    );
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
    owner,
    internal,
    internalComments:
      copy === "full" && has(p.internal_comments) ? String(p.internal_comments).trim() : null,
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
