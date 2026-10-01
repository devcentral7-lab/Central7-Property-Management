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
  amenities: string[];
  contactTypes: string[];
  opportunityTypes: string[];
  propertyTypes: string[];
  furnished: string[];
  currencies: string[];
  statuses: string[];
  platforms: string[];
  statusChangeOptions: string[];
};

export const FORM_LIST_META: {
  key: FormListKey;
  title: string;
  field: keyof FormOptions;
}[] = [
  { key: "amenities_list", title: "Amenities", field: "amenities" },
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

const FALLBACK: FormOptions = {
  amenities: sortAlpha(AMENITIES_LIST),
  contactTypes: sortAlpha(CONTACT_TYPES),
  opportunityTypes: sortAlpha(OPPORTUNITY_TYPES),
  propertyTypes: sortAlpha(PROPERTY_TYPES),
  furnished: sortAlpha(FURNISHED_LIST),
  currencies: sortAlpha(["LKR", "USD"]),
  statuses: sortAlpha(STATUS_LIST),
  platforms: sortAlpha(SOCIAL_MEDIA_PLATFORMS),
  statusChangeOptions: sortAlpha(STATUS_CHANGE_OPTIONS),
};

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return items.length ? items : [];
}

function fromRows(
  rows: { key: string; value: unknown }[] | null,
): FormOptions {
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const pick = (key: FormListKey, fallback: string[]) => {
    const list = asStringArray(map.get(key));
    return sortAlpha(list ?? fallback);
  };

  return {
    amenities: pick("amenities_list", FALLBACK.amenities),
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
