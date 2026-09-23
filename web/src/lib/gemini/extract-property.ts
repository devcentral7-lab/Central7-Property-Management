import type { FormOptions } from "@/lib/form-options";
import {
  CONTACT_TYPES,
  FURNISHED_LIST,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
} from "@/lib/constants";

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
  latitude?: number | string | null;
  longitude?: number | string | null;
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
  set("property_subtype", strVal(raw.property_subtype));
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
    "latitude",
    "longitude",
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

function buildPrompt(paragraph: string, lists: EnumLists): string {
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
    "price_per_perch, price_per_sqft, price_total, budget, latitude, longitude — numbers only.",
    "property_subtype: free text when a more specific type is stated (villa, annex, shop…).",
    "amenities: array of short strings when mentioned.",
    "comments: leftover useful notes not mapped to other fields (optional).",
    "Map rent/lease → opportunity_type Rent Out; sale/selling → Sell.",
    "Map house/villa → House; land/plot → Land; flat/condo → Apartment;",
    "shop/office/warehouse → Commercial Property; estate/large compound → Estate.",
    "",
    "JSON keys:",
    "contact_type, contact_name, contact_phone_1, contact_phone_2, contact_email,",
    "opportunity_type, property_type, property_subtype, city, address, purpose,",
    "land_size_perch, floor_area_sqft, bedrooms, bathrooms, number_of_floors,",
    "parking_spaces, age_years, apartment_floor, view, latitude, longitude,",
    "suitable_for, built_up_area, currency, furnished,",
    "price_per_perch, price_per_sqft, price_total, budget, amenities, comments",
    "",
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

export async function extractPropertyFieldsWithGemini(
  paragraph: string,
  formOptions?: FormOptions,
): Promise<Record<string, string>> {
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

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(input, lists) }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

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

  const parsed = parseJsonObject(text);
  return normalizeExtractedFields(parsed, lists);
}
