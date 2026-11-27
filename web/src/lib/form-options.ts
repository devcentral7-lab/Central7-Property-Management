import {
  type AmenityOption,
  parseAmenityOptions,
} from "@/lib/amenity-category";
import {
  AMENITIES_LIST,
  CONTACT_TYPES,
  FURNISHED_LIST,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
  SOCIAL_MEDIA_PLATFORMS,
  STATUS_CHANGE_OPTIONS,
  STATUS_LIST,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type { AmenityCategory, AmenityOption } from "@/lib/amenity-category";

/** Keys stored in app_settings for listing form dropdowns / checkboxes. */
export const FORM_LIST_KEYS = [
  "amenities_list",
  "contact_types",
  "opportunity_types",
  "property_types",
  "furnished_list",
  "currencies",
  "status_list",
  "social_media_platforms",
  "status_change_options",
] as const;

export type FormListKey = (typeof FORM_LIST_KEYS)[number];

export type FormOptions = {
  /** Amenity names for checkboxes / matching (order preserved). */
  amenities: string[];
  /** Same list with Feature vs Amenity category for PDFs / admin editor. */
  amenityOptions: AmenityOption[];
  contactTypes: string[];
  opportunityTypes: string[];
  propertyTypes: string[];
  furnished: string[];
  currencies: string[];
  statuses: string[];
  platforms: string[];
  statusChangeOptions: string[];
};

export type FormListStringField = Exclude<keyof FormOptions, "amenityOptions">;

export const FORM_LIST_META: {
  key: FormListKey;
  title: string;
  field: FormListStringField;
  categorized?: boolean;
}[] = [
  {
    key: "amenities_list",
    title: "Amenities & Features",
    field: "amenities",
    categorized: true,
  },
  { key: "contact_types", title: "Contact Types", field: "contactTypes" },
  {
    key: "opportunity_types",
    title: "Opportunity Types",
    field: "opportunityTypes",
  },
  { key: "property_types", title: "Property Types", field: "propertyTypes" },
  { key: "furnished_list", title: "Furnished Options", field: "furnished" },
  { key: "currencies", title: "Currencies", field: "currencies" },
  { key: "status_list", title: "Listing Statuses", field: "statuses" },
  {
    key: "social_media_platforms",
    title: "Publish Platforms",
    field: "platforms",
  },
  {
    key: "status_change_options",
    title: "Status Change Actions",
    field: "statusChangeOptions",
  },
];

function sortAlpha(arr: readonly string[] | string[]): string[] {
  return [...arr].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

const FALLBACK_AMENITY_OPTIONS = parseAmenityOptions(null, sortAlpha(AMENITIES_LIST));

/** Used only if the saved lists can't be read; normally Admins set each list's order. */
const FALLBACK: FormOptions = {
  amenities: FALLBACK_AMENITY_OPTIONS.map((a) => a.name),
  amenityOptions: FALLBACK_AMENITY_OPTIONS,
  contactTypes: [...CONTACT_TYPES],
  opportunityTypes: [...OPPORTUNITY_TYPES],
  propertyTypes: [...PROPERTY_TYPES],
  furnished: [...FURNISHED_LIST],
  currencies: ["LKR", "USD"],
  statuses: [...STATUS_LIST],
  platforms: [...SOCIAL_MEDIA_PLATFORMS],
  statusChangeOptions: [...STATUS_CHANGE_OPTIONS],
};

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((v) => {
      if (typeof v === "string") return v.trim();
      if (v && typeof v === "object" && !Array.isArray(v) && "name" in v) {
        return String((v as { name: unknown }).name ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
  return items.length ? items : [];
}

function fromRows(
  rows: { key: string; value: unknown }[] | null,
): FormOptions {
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const pick = (key: FormListKey, fallback: string[]) => {
    return asStringArray(map.get(key)) ?? fallback;
  };

  const amenityOptions = parseAmenityOptions(
    map.get("amenities_list"),
    FALLBACK.amenities,
  );

  return {
    amenities: amenityOptions.map((a) => a.name),
    amenityOptions,
    contactTypes: pick("contact_types", FALLBACK.contactTypes),
    opportunityTypes: pick("opportunity_types", FALLBACK.opportunityTypes),
    propertyTypes: pick("property_types", FALLBACK.propertyTypes),
    furnished: pick("furnished_list", FALLBACK.furnished),
    currencies: pick("currencies", FALLBACK.currencies),
    statuses: pick("status_list", FALLBACK.statuses),
    platforms: pick("social_media_platforms", FALLBACK.platforms),
    statusChangeOptions: pick(
      "status_change_options",
      FALLBACK.statusChangeOptions,
    ),
  };
}

export async function loadFormOptions(): Promise<FormOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [...FORM_LIST_KEYS]);

  if (error) {
    console.error("loadFormOptions", error.message);
    return FALLBACK;
  }

  return fromRows(data);
}

export function optionsForKey(
  options: FormOptions,
  key: FormListKey,
): string[] {
  const meta = FORM_LIST_META.find((m) => m.key === key);
  return meta ? options[meta.field] : [];
}
