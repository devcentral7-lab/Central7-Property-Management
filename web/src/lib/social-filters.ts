/** Values of the property search `social` filter. */
export const SOCIAL_FILTERS = [
  { value: "published", label: "Published" },
  { value: "awaiting_approval", label: "Waiting for approval" },
  { value: "approved", label: "Approved, being posted" },
  { value: "pending", label: "Any pending request" },
  { value: "taken_down", label: "Taken down" },
  { value: "never", label: "Never published" },
] as const;
