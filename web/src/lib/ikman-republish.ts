/** Weekly Ikman.lk expired-ad republish helpers. */

export const IKMAN_ITEM_STATUSES = [
  "pending_owner",
  "approved_by_owner",
  "declined_by_owner",
  "republished",
  "cancelled",
] as const;

export type IkmanItemStatus = (typeof IKMAN_ITEM_STATUSES)[number];

export type IkmanDisposition =
  | "new"
  | "pending_owner"
  | "pending_admin"
  | "suppressed"
  | "recently_done"
  | "not_found"
  | "not_active"
  | "no_owner";

export type IkmanPreviewRow = {
  ref_no: string;
  disposition: IkmanDisposition;
  defaultInclude: boolean;
  property_id: string | null;
  property_status: string | null;
  owner_id: string | null;
  owner_name: string | null;
  property_type: string | null;
  opportunity_type: string | null;
  city: string | null;
  existing_item_id: string | null;
  existing_status: IkmanItemStatus | null;
  note: string;
};

const REF_RE = /\bC7-(\d+)\b/gi;

/** Extract unique C7-##### refs from noisy Ikman page paste text. */
export function extractIkmanRefNos(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of raw.matchAll(REF_RE)) {
    const ref = `C7-${match[1]}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

export function dispositionLabel(d: IkmanDisposition): string {
  switch (d) {
    case "new":
      return "New — send to owner";
    case "pending_owner":
      return "Already with owner";
    case "pending_admin":
      return "Already ready for Admin";
    case "suppressed":
      return "Owner declined (suppressed)";
    case "recently_done":
      return "Already republished (skipped)";
    case "not_found":
      return "Not in database";
    case "not_active":
      return "Not Active";
    case "no_owner":
      return "No owner on listing";
  }
}

/** Dispositions Admin may force-include when confirming a paste. */
export function canForceInclude(d: IkmanDisposition): boolean {
  return d === "new" || d === "suppressed" || d === "recently_done";
}

export function ikmanStatusLabel(status: IkmanItemStatus): string {
  switch (status) {
    case "pending_owner":
      return "Waiting on owner";
    case "approved_by_owner":
      return "Ready to republish";
    case "declined_by_owner":
      return "Declined";
    case "republished":
      return "Republished";
    case "cancelled":
      return "Cancelled";
  }
}

/** UI label for the social-media status action (DB value stays "Republish"). */
export function statusChangeLabel(action: string): string {
  if (action === "Republish") return "Social Media Refresh";
  return action;
}
