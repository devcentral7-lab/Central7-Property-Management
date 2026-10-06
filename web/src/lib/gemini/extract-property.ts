import type { FormOptions } from "@/lib/form-options";
import {
  COMMERCIAL_SUBTYPES,
  CONTACT_TYPES,
  FURNISHED_LIST,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
} from "@/lib/constants";
import { matchCities } from "@/lib/cities";
import { matchAmenities, matchComplexes, type NamedOption } from "@/lib/listing-match";
import { parseMapsLink } from "@/lib/maps-link";
import { typeSpecificKeys } from "@/lib/property-fields";
import { SEARCH_RANGE_KEYS } from "@/lib/paragraph-search-filters";

/** Partial listing fields Gemini may return. Null/omitted = leave blank. */
export type ExtractedPropertyFields = {
  contact_type?: string | null;
  contact_name?: string | null;
  contact_phone_1?: string | null;
  contact_phone_2?: string | null;
  contact_email?: string | null;
  opportunity_type?: string | null;
  property_type?: string | null;
  property_subtype?: string | null;
  city?: string | null;
  address?: string | null;
  purpose?: string | null;
  land_size_perch?: number | string | null;
  floor_area_sqft?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  number_of_floors?: number | string | null;
  parking_spaces?: number | string | null;
  age_years?: number | string | null;
  apartment_floor?: string | null;
  view?: string | null;
  suitable_for?: string | null;
  built_up_area?: number | string | null;
  currency?: string | null;
  furnished?: string | null;
  price_per_perch?: number | string | null;
  price_per_sqft?: number | string | null;
  price_total?: number | string | null;
  budget?: number | string | null;
  amenities?: string[] | string | null;
  comments?: string | null;
} & Partial<Record<(typeof SEARCH_RANGE_KEYS)[number], number | string | null>> & {
  status?: string | null;
  cities?: string[] | string | null;
  apartment_complex?: string[] | string | null;
};

const DEFAULT_MODEL = "gemini-flash-lite-latest";

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key.startsWith("REPLACE_ME") || key === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    return null;
  }
  return key;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

function strVal(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

type EnumLists = {
  contactTypes: string[];
  opportunityTypes: string[];
  propertyTypes: string[];
  furnished: string[];
  currencies: string[];
};

function defaultEnums(): EnumLists {
  return {
    contactTypes: [...CONTACT_TYPES],
    opportunityTypes: [...OPPORTUNITY_TYPES],
    propertyTypes: [...PROPERTY_TYPES],
    furnished: [...FURNISHED_LIST],
    currencies: ["LKR", "USD"],
  };
}

/** Normalize Gemini JSON into form-safe string values (empty = skip). */
export function normalizeExtractedFields(
  raw: ExtractedPropertyFields,
  lists: EnumLists = defaultEnums(),
): Record<string, string> {
  const out: Record<string, string> = {};

  const set = (key: string, value: string) => {
    if (value) out[key] = value;
  };

  set("contact_name", strVal(raw.contact_name));
  set("contact_phone_1", strVal(raw.contact_phone_1));
  set("contact_phone_2", strVal(raw.contact_phone_2));
  set("contact_email", strVal(raw.contact_email));
  set("city", strVal(raw.city));
  set("address", strVal(raw.address));
  set("purpose", strVal(raw.purpose));
  set("apartment_floor", strVal(raw.apartment_floor));
  set("view", strVal(raw.view));
  set("suitable_for", strVal(raw.suitable_for));
  set("comments", strVal(raw.comments));

  const contactType = strVal(raw.contact_type);
  if (lists.contactTypes.includes(contactType)) {
    out.contact_type = contactType;
  }

  const opp = strVal(raw.opportunity_type);
  if (lists.opportunityTypes.includes(opp)) {
    out.opportunity_type = opp;
  }

  const ptype = strVal(raw.property_type);
  if (lists.propertyTypes.includes(ptype)) {
    out.property_type = ptype;
  }

  const subtype = strVal(raw.property_subtype).toLowerCase();
  const subtypeMatch = COMMERCIAL_SUBTYPES.find((s) => s.toLowerCase() === subtype);
  if (subtypeMatch && (!out.property_type || out.property_type === "Commercial Property")) {
    out.property_subtype = subtypeMatch;
  }

  const furnished = strVal(raw.furnished);
  if (lists.furnished.includes(furnished)) {
    out.furnished = furnished;
  }

  const currency = strVal(raw.currency).toUpperCase();
  if (lists.currencies.map((c) => c.toUpperCase()).includes(currency)) {
    out.currency =
      lists.currencies.find((c) => c.toUpperCase() === currency) || currency;
  }

  for (const key of [
    "land_size_perch",
    "floor_area_sqft",
    "bedrooms",
    "bathrooms",
    "number_of_floors",
    "parking_spaces",
    "age_years",
    "built_up_area",
    "price_per_perch",
    "price_per_sqft",
    "price_total",
    "budget",
  ] as const) {
    const n = strVal(raw[key]).replace(/,/g, "");
    if (n && Number.isFinite(Number(n))) out[key] = n;
  }

  if (Array.isArray(raw.amenities)) {
    const joined = raw.amenities.map((a) => strVal(a)).filter(Boolean).join(", ");
    if (joined) out.amenities = joined;
  } else {
    set("amenities", strVal(raw.amenities));
  }

  return out;
}

function buildPrompt(
  paragraph: string,
  lists: EnumLists,
  search: boolean,
  statuses: string[],
  context: ExtractContext,
  amenities: readonly string[],
): string {
  const cities = context.cities ?? [];
  const complexes = context.complexes ?? [];
  return [
    "You extract structured real-estate listing fields from informal Sri Lankan property notes.",
    "Return ONLY a JSON object. Use null for any field not clearly stated — do not invent values.",
    "Paragraphs vary; extract only what is present.",
    "",
    "Allowed enums (exact strings when used):",
    `contact_type: ${lists.contactTypes.join(" | ")}`,
    `opportunity_type: ${lists.opportunityTypes.join(" | ")}`,
    `property_type: ${lists.propertyTypes.join(" | ")}`,
    `furnished: ${lists.furnished.join(" | ")}`,
    `currency: ${lists.currencies.join(" | ")}`,
    "",
    "Numeric fields: land_size_perch, floor_area_sqft, bedrooms, bathrooms,",
    "number_of_floors, parking_spaces, age_years, built_up_area,",
    "price_per_perch, price_per_sqft, price_total, budget — plain numbers only.",
    "Amounts: k = thousand (400k = 400000), lakh = 100000 (25 lakhs = 2500000), M/Mn/million = 1000000 (Rs 45M = 45000000), bn = 1000000000.",
    "currency: Rs/LKR/rupees → LKR; $/USD/dollars → USD; null when no amount is given.",
    "price_total is the full asking price for a sale, or the monthly rent for a rental.",
    `property_subtype: only for Commercial Property, one of ${COMMERCIAL_SUBTYPES.join(" | ")}; otherwise null.`,
    "For Commercial Property put the building floor area in built_up_area.",
    "Map rent/lease → opportunity_type Rent Out; sale/selling → Sell.",
    "Map house/villa → House; land/plot → Land; flat/condo → Apartment;",
    "shop/office/warehouse → Commercial Property; estate/large compound → Estate.",
    "Map semi/partly furnished → Partly Furnished; unfurnished → Not Furnished; fully furnished → Fully Furnished.",
    "Map owner/direct/landlord → contact_type Direct; agent/broker/partner → Partner.",
    "For apartments, 'rooms' means bedrooms.",
    ...(cities.length ? [`city: use the exact name from this list: ${cities.join(", ")}.`] : []),
    search
      ? "apartment_complex: JSON array of every apartment building or complex named, [] if none."
      : "apartment_complex: name of the apartment building or complex, if mentioned.",
    ...(complexes.length ? [`Known complexes: ${complexes.map((c) => c.name).join(", ")}. Use the exact known name when it is one of these; otherwise give the name as written.`] : []),
    "amenities: array of short strings when mentioned.",
    ...(amenities.length ? [`Use these exact amenity names when they mean the same thing: ${amenities.join(", ")}.`] : []),
    "comments: extra useful details not mapped to other fields (condition, access, terms).",
    "Never put contact names, phone numbers, emails or prices in comments.",
    "",
    "JSON keys:",
    "contact_type, contact_name, contact_phone_1, contact_phone_2, contact_email,",
    "opportunity_type, property_type, property_subtype, city, address, purpose,",
    "land_size_perch, floor_area_sqft, bedrooms, bathrooms, number_of_floors,",
    "parking_spaces, age_years, apartment_complex, apartment_floor, view,",
    "suitable_for, built_up_area, currency, furnished,",
    "price_per_perch, price_per_sqft, price_total, budget, amenities, comments",
    "",
    ...(search ? [
      "This is a property search request, not a listing to create. Also extract these search filter keys:",
      SEARCH_RANGE_KEYS.join(", "),
      `status: ${statuses.join(" | ")}; only set a status if explicitly requested.`,
      "cities: JSON array of every location the person wants to search in, [] if none.",
      ...(cities.length ? ["Use exact names from the city list above."] : []),
      "Expand shorthand like 'Colombo 4,5,6' into separate entries: Colombo 04, Colombo 05, Colombo 06.",
      "Put searched locations only in cities; leave city and address null.",
      "Use numeric bounds for ranges, minimums, maximums, at least, up to, under, and over.",
      "For an exact quantity, set both its min and max. Do not invent tolerances or bounds.",
      "A budget, maximum rent/price or 'under' amount sets price_max; a minimum price sets price_min.",
      "Leave price_total, budget, budget_min and budget_max null.",
      "For 3+ bedrooms set bedrooms_min=3 and leave bedrooms_max null.",
      "land_min/land_max are perches; floor_min/floor_max are square feet.",
    ] : []),
    "Notes:",
    paragraph,
  ].join("\n");
}

function parseJsonObject(text: string): ExtractedPropertyFields {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Gemini returned no JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as ExtractedPropertyFields;
}

export type ExtractContext = {
  cities?: readonly string[];
  complexes?: readonly NamedOption[];
};

export type Extraction = {
  fields: Record<string, string>;
  /** Things the user should check, e.g. a city that isn't in the list. */
  notes: string[];
};

/** Detail fields each property type's form shows; others are dropped after extraction. */
const TYPE_DETAIL_KEYS = [
  "land_size_perch",
  "floor_area_sqft",
  "bedrooms",
  "bathrooms",
  "number_of_floors",
  "parking_spaces",
  "age_years",
  "apartment_floor",
  "view",
  "suitable_for",
  "built_up_area",
] as const;

function tidyListingFields(fields: Record<string, string>) {
  const type = fields.property_type;
  if (!type) return;
  if (type === "Commercial Property" && !fields.built_up_area && fields.floor_area_sqft) {
    fields.built_up_area = fields.floor_area_sqft;
  }
  if ((type === "Commercial Property" || type === "Land") && fields.purpose && !fields.suitable_for) {
    fields.suitable_for = fields.purpose;
  }
  if (type !== "House" && type !== "Estate") delete fields.purpose;
  const allowed = typeSpecificKeys(type);
  for (const k of TYPE_DETAIL_KEYS) if (!allowed.has(k)) delete fields[k];
  const comment = fields.comments?.toLowerCase();
  if (comment && [fields.suitable_for, fields.purpose, fields.view].some((v) => v?.toLowerCase() === comment)) {
    delete fields.comments;
  }
}

export async function extractPropertyFieldsWithGemini(
  paragraph: string,
  formOptions?: FormOptions,
  search = false,
  context: ExtractContext = {},
): Promise<Extraction> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      "Gemini is not configured. Add GEMINI_API_KEY to web/.env.local and restart the dev server.",
    );
  }

  const input = paragraph.trim();
  if (!input) throw new Error("Paste a property paragraph first.");
  if (input.length > 8000) {
    throw new Error("Paragraph is too long (max ~8000 characters).");
  }

  const lists: EnumLists = formOptions
    ? {
        contactTypes: formOptions.contactTypes,
        opportunityTypes: formOptions.opportunityTypes,
        propertyTypes: formOptions.propertyTypes,
        furnished: formOptions.furnished,
        currencies: formOptions.currencies,
      }
    : defaultEnums();

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const prompt = buildPrompt(input, lists, search, formOptions?.statuses ?? [], context, formOptions?.amenities ?? []);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("Gemini took too long to respond. Please try again.");
    }
    throw new Error("Could not reach Gemini. Check your connection and try again.");
  }

  const bodyText = await resp.text();
  if (!resp.ok) {
    let detail = bodyText.slice(0, 300);
    try {
      const errJson = JSON.parse(bodyText) as { error?: { message?: string } };
      detail = errJson.error?.message || detail;
    } catch {
      /* keep slice */
    }
    throw new Error(`Gemini request failed (${resp.status}): ${detail}`);
  }

  const data = JSON.parse(bodyText) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  let raw: ExtractedPropertyFields;
  try {
    raw = parseJsonObject(text);
  } catch {
    throw new Error("Gemini returned an unreadable answer. Please try again.");
  }
  const fields = normalizeExtractedFields(raw, lists);
  const notes: string[] = [];
  const cities = context.cities ?? [];
  const complexes = context.complexes ?? [];
  const complexNames = (Array.isArray(raw.apartment_complex) ? raw.apartment_complex : [raw.apartment_complex])
    .map(strVal)
    .filter(Boolean);
  const named = complexes.length ? matchComplexes(complexNames, complexes, input) : [];

  if (search) {
    for (const key of SEARCH_RANGE_KEYS) {
      const value = strVal(raw[key]).replace(/,/g, "");
      if (value && Number.isFinite(Number(value)) && Number(value) >= 0) fields[key] = value;
    }
    const status = strVal(raw.status);
    if (formOptions?.statuses.includes(status)) fields.status = status;

    const places = [raw.cities, raw.city]
      .flatMap((v) => (Array.isArray(v) ? v : strVal(v).split(",")))
      .map(strVal)
      .filter(Boolean);
    // The complex filter takes one complex; several narrow the search to their cities instead.
    if (named.length === 1) fields.complex = named[0].id;
    else for (const c of named) if (c.location) places.push(c.location);
    const matched = cities.length ? matchCities(places, cities, input) : places;
    if (matched.length) fields.city = matched.join(",");
    else delete fields.city;
    return { fields, notes };
  }

  for (const k of ["contact_phone_1", "contact_phone_2"] as const) {
    if (fields[k]) fields[k] = normalizePhone(fields[k]);
  }

  const complex = named.length === 1 ? named[0] : null;
  if (complex) {
    fields.apartment_complex_id = complex.id;
    if (!fields.property_type && lists.propertyTypes.includes("Apartment")) fields.property_type = "Apartment";
  } else if (named.length > 1) {
    notes.push(`Several apartment complexes are mentioned (${named.map((c) => c.name).join(", ")}), so select the right one.`);
  } else if (complexNames.length) {
    notes.push(`Apartment complex “${complexNames[0]}” isn’t in the list, so select it manually or add it under Apartment Complexes.`);
  }

  if (cities.length) {
    const stated = fields.city;
    delete fields.city;
    const fromText = matchCities([], cities, input);
    const fromComplex = complex?.location ? matchCities([complex.location], cities) : [];
    const [hit] = stated ? matchCities([stated], cities) : [];
    if (hit) fields.city = hit;
    else if (fromComplex.length) fields.city = fromComplex[0];
    else if (fromText.length === 1) fields.city = fromText[0];
    if (stated && !hit && !fields.city) {
      notes.push(`City “${stated}” isn’t in the city list, so pick the closest one.`);
      if (!fields.address) fields.address = stated;
    }
  }

  if (fields.amenities) {
    const { matched, extras } = matchAmenities(fields.amenities.split(","), formOptions?.amenities ?? []);
    fields.amenities = [...matched, ...extras].join(", ");
    if (!fields.amenities) delete fields.amenities;
  }

  tidyListingFields(fields);

  // Read straight from the notes — the model can mangle long share URLs.
  const mapsLink = parseMapsLink(input);
  if (mapsLink.ok && mapsLink.url) fields.location_url = mapsLink.url;
  return { fields, notes };
}

/** Restores the leading 0 when a local mobile number comes back as 9 digits. */
function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "");
  return /^7\d{8}$/.test(compact) ? `0${compact}` : raw.trim();
}
