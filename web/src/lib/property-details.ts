import { typeSpecificKeys } from "@/lib/property-fields";

export type DetailField = { label: string; value: string; href?: string };

export type DetailSectionId = "property" | "location" | "pricing" | "contact" | "record";

export type DetailSection = { id: DetailSectionId; title: string; fields: DetailField[] };

export type FactIcon = "area" | "land" | "bed" | "bath" | "floors" | "parking";

export type PropertyDetailsModel = {
  refNo: string;
  status: string | null;
  propertyType: string | null;
  opportunity: string | null;
  city: string | null;
  price: string | null;
  priceNote: string | null;
  facts: { icon: FactIcon; label: string; value: string }[];
  sections: DetailSection[];
  amenities: string[];
  doNotPublish: boolean;
};

type Row = Record<string, unknown>;

function has(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return Boolean(v.trim());
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function str(v: unknown): string | null {
  return has(v) ? String(v).trim() : null;
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

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function buildPropertyDetails(
  p: Row,
  extras: { complexName?: string | null; lat?: number | null; lng?: number | null },
): PropertyDetailsModel {
  const propertyType = str(p.property_type);
  const opportunity = str(p.opportunity_type);
  const currency = str(p.currency) || "LKR";
  const isLand = propertyType === "Land";
  const rent = /rent|lease/i.test(opportunity || "");
  const allowed = typeSpecificKeys(propertyType || "");
  const attrs = (p.type_attributes || {}) as Row;
  const pick = (key: string, value: unknown) => allowed.has(key) && has(value);

  const facts: PropertyDetailsModel["facts"] = [];
  if (pick("bedrooms", p.bedrooms)) facts.push({ icon: "bed", label: "Bedrooms", value: num(p.bedrooms) });
  if (pick("bathrooms", p.bathrooms)) facts.push({ icon: "bath", label: "Bathrooms", value: num(p.bathrooms) });
  if (pick("floor_area_sqft", p.floor_area_sqft))
    facts.push({ icon: "area", label: "Sq.ft", value: num(p.floor_area_sqft) });
  if (pick("land_size_perch", p.land_size_perch))
    facts.push({ icon: "land", label: "Perches", value: num(p.land_size_perch) });
  if (pick("number_of_floors", p.number_of_floors))
    facts.push({ icon: "floors", label: "Floors", value: num(p.number_of_floors) });
  if (pick("parking_spaces", p.parking_spaces))
    facts.push({ icon: "parking", label: "Parking", value: num(p.parking_spaces) });

  const collect = (entries: [string, unknown, boolean?, string?][]): DetailField[] =>
    entries.flatMap(([label, value, ok = has(value), href]) =>
      ok && has(value) ? [{ label, value: String(value), ...(href ? { href } : {}) }] : [],
    );

  const complexName = allowed.has("apartment_complex") ? str(extras.complexName) : null;
  const property = collect([
    ["Property type", propertyType],
    ["Sub-type", p.property_subtype],
    ["Opportunity", opportunity],
    ["Apartment complex", complexName],
    ["Apartment floor", p.apartment_floor, pick("apartment_floor", p.apartment_floor)],
    ["View", p.view, pick("view", p.view)],
    ["Furnished", p.furnished],
    ["Purpose", p.purpose, allowed.has("purpose") && has(p.purpose)],
    ["Suitable for", attrs.suitable_for, pick("suitable_for", attrs.suitable_for)],
    ["Built-up area", attrs.built_up_area, pick("built_up_area", attrs.built_up_area)],
    ["Age", has(p.age_years) ? `${num(p.age_years)} years` : null, pick("age_years", p.age_years)],
  ]);

  const hasCoords = extras.lat != null && extras.lng != null;
  const location = collect([
    ["City", p.city],
    ["Address", p.address],
    [
      "Coordinates",
      hasCoords ? `${extras.lat}, ${extras.lng}` : null,
      hasCoords,
      hasCoords ? `https://www.google.com/maps?q=${extras.lat},${extras.lng}` : undefined,
    ],
  ]);

  const pricing = collect([
    [rent ? "Monthly rent" : "Total price", money(p.price_total, currency)],
    ["Price per perch", money(p.price_per_perch, currency)],
    ["Price per sq.ft", money(p.price_per_sqft, currency), !isLand],
    ["Budget", money(p.budget, currency), !isLand],
    ["Currency", currency],
  ]);

  const phone1 = str(p.contact_phone_1);
  const phone2 = str(p.contact_phone_2);
  const email = str(p.contact_email);
  const contact = collect([
    ["Contact type", p.contact_type],
    ["Name", p.contact_name],
    ["Phone 1", phone1, true, phone1 ? telHref(phone1) : undefined],
    ["Phone 2", phone2, true, phone2 ? telHref(phone2) : undefined],
    ["Email", email, true, email ? `mailto:${email}` : undefined],
  ]);

  const record = collect([
    ["Created by", p.created_by_name],
    [
      "Created",
      has(p.created_at)
        ? new Date(String(p.created_at)).toLocaleString("en-GB", {
            timeZone: "Asia/Colombo",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null,
    ],
    [
      "Last updated",
      has(p.updated_at)
        ? new Date(String(p.updated_at)).toLocaleString("en-GB", {
            timeZone: "Asia/Colombo",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null,
    ],
    ["Publishing", p.do_not_publish ? "Do not publish" : "Can be published"],
  ]);

  const sections: DetailSection[] = (
    [
      { id: "property", title: "Property", fields: property },
      { id: "location", title: "Location", fields: location },
      { id: "pricing", title: "Pricing", fields: pricing },
      { id: "contact", title: "Owner contact", fields: contact },
      { id: "record", title: "Listing record", fields: record },
    ] as DetailSection[]
  ).filter((s) => s.fields.length);

  const priceNote = rent
    ? "per month"
    : isLand || !has(p.price_per_sqft)
      ? has(p.price_per_perch)
        ? `${money(p.price_per_perch, currency)} / perch`
        : null
      : `${money(p.price_per_sqft, currency)} / sq.ft`;

  return {
    refNo: String(p.ref_no),
    status: str(p.status),
    propertyType,
    opportunity,
    city: str(p.city),
    price: money(p.price_total, currency),
    priceNote: has(p.price_total) ? priceNote : null,
    facts,
    sections,
    amenities: ((p.amenities || []) as string[]).filter(has),
    doNotPublish: Boolean(p.do_not_publish),
  };
}
