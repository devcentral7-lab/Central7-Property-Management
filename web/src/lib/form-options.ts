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
  description: string;
  field: keyof FormOptions;
}[] = [
  {
    key: "amenities_list",
    title: "Amenities",
    description: "Checkbox options on the listing form.",
    field: "amenities",
  },
  {
    key: "contact_types",
    title: "Contact types",
    description: "Direct / Partner, etc.",
    field: "contactTypes",
  },
  {
    key: "opportunity_types",
    title: "Opportunity types",
    description: "Sell, Rent Out, and any custom options.",
    field: "opportunityTypes",
  },
  {
    key: "property_types",
    title: "Property types",
    description: "House, Land, Apartment, and custom types.",
    field: "propertyTypes",
  },
  {
    key: "furnished_list",
    title: "Furnished options",
    description: "Furnished dropdown on pricing.",
    field: "furnished",
  },
  {
    key: "currencies",
    title: "Currencies",
    description: "Currency codes shown on the form.",
    field: "currencies",
  },
  {
    key: "status_list",
    title: "Listing statuses",
    description: "Active, Hold, Lost, and other listing statuses.",
    field: "statuses",
  },
  {
    key: "social_media_platforms",
    title: "Publish platforms",
    description: "Ikman, LPW, Facebook, Instagram, …",
    field: "platforms",
  },
  {
    key: "status_change_options",
    title: "Status change actions",
    description: "Actions on the property detail activity form.",
    field: "statusChangeOptions",
  },
];

const FALLBACK: FormOptions = {
  amenities: [...AMENITIES_LIST],
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
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return items.length ? items : [];
}

function fromRows(
  rows: { key: string; value: unknown }[] | null,
): FormOptions {
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  const pick = (key: FormListKey, fallback: string[]) =>
    asStringArray(map.get(key)) ?? fallback;

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
