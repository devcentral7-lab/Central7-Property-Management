export type PropertyFieldChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

const FIELD_LABELS: Record<string, string> = {
  contact_type: "Contact type",
  contact_name: "Contact name",
  contact_phone_1: "Phone 1",
  contact_phone_2: "Phone 2",
  contact_email: "Email",
  opportunity_type: "Opportunity",
  property_type: "Property type",
  purpose: "Purpose",
  property_subtype: "Subtype",
  address: "Address",
  city: "City",
  location_url: "Maps link",
  land_size_perch: "Land (perches)",
  floor_area_sqft: "Floor area (sq.ft)",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  number_of_floors: "Floors",
  parking_spaces: "Parking",
  age_years: "Age (years)",
  apartment_floor: "Apt. floor",
  view: "View",
  currency: "Currency",
  price_per_perch: "Price per perch",
  price_per_sqft: "Price per sq.ft",
  price_total: "Price / rent",
  budget: "Budget",
  furnished: "Furnished",
  status: "Status",
  do_not_publish: "Do not publish",
  amenities: "Amenities",
  comments: "Comments",
  internal_comments: "Internal comments",
};

const ATTR_LABELS: Record<string, string> = {
  agent_ref_no: "Partner ref",
  suitable_for: "Suitable for",
  built_up_area: "Built-up area",
};

/** Fields that are noisy or not human-readable in History. */
const SKIP_FIELDS = new Set(["apartment_complex_id"]);

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("en-LK") : "—";
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v).trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value).trim() || "—";
}

function normalizeComparable(value: unknown): unknown {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    return [...value].map((v) => String(v).trim()).filter(Boolean).sort();
  }
  if (typeof value === "object") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  return String(value).trim();
}

function sameValue(a: unknown, b: unknown): boolean {
  const na = normalizeComparable(a);
  const nb = normalizeComparable(b);
  if (na === nb) return true;
  if (na == null && nb == null) return true;
  if (Array.isArray(na) && Array.isArray(nb)) {
    return na.length === nb.length && na.every((v, i) => v === nb[i]);
  }
  if (
    na &&
    nb &&
    typeof na === "object" &&
    typeof nb === "object" &&
    !Array.isArray(na) &&
    !Array.isArray(nb)
  ) {
    return JSON.stringify(na) === JSON.stringify(nb);
  }
  return false;
}

function pushChange(
  out: PropertyFieldChange[],
  field: string,
  label: string,
  from: unknown,
  to: unknown,
) {
  if (sameValue(from, to)) return;
  out.push({
    field,
    label,
    from: displayValue(from),
    to: displayValue(to),
  });
}

export function diffPropertyFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): PropertyFieldChange[] {
  const changes: PropertyFieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (SKIP_FIELDS.has(key)) continue;
    if (key === "type_attributes") {
      const prevAttrs =
        before.type_attributes && typeof before.type_attributes === "object"
          ? (before.type_attributes as Record<string, unknown>)
          : {};
      const nextAttrs =
        after.type_attributes && typeof after.type_attributes === "object"
          ? (after.type_attributes as Record<string, unknown>)
          : {};
      const attrKeys = new Set([...Object.keys(prevAttrs), ...Object.keys(nextAttrs)]);
      for (const attr of attrKeys) {
        pushChange(
          changes,
          `type_attributes.${attr}`,
          ATTR_LABELS[attr] ?? attr.replace(/_/g, " "),
          prevAttrs[attr],
          nextAttrs[attr],
        );
      }
      continue;
    }

    const label = FIELD_LABELS[key];
    if (!label) continue;
    pushChange(changes, key, label, before[key], after[key]);
  }

  return changes;
}

export function formatPropertyChanges(changes: PropertyFieldChange[]): string | null {
  if (!changes.length) return null;
  return changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join("\n");
}
