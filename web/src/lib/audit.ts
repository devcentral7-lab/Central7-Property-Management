import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuditInput = {
  category:
    | "auth"
    | "property"
    | "staff"
    | "partner"
    | "settings"
    | "queue"
    | "other";
  action: string;
  actorName?: string | null;
  actorKind?: "staff" | "agent" | "system" | "unknown" | null;
  subjectType?: string | null;
  subjectId?: string | null;
  subjectLabel?: string | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
};

/** Best-effort audit write — never throws to callers. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        null;
      userAgent = h.get("user-agent");
    } catch {
      /* headers() unavailable outside request */
    }

    const { error } = await supabase.rpc("log_audit_event", {
      p_category: input.category,
      p_action: input.action,
      p_actor_name: input.actorName ?? null,
      p_actor_kind: input.actorKind ?? null,
      p_subject_type: input.subjectType ?? null,
      p_subject_id: input.subjectId ?? null,
      p_subject_label: input.subjectLabel ?? null,
      p_summary: input.summary ?? null,
      p_details: input.details ?? {},
      p_ip: ip,
      p_user_agent: userAgent,
    });
    if (error) console.error("logAudit", error.message);
  } catch (e) {
    console.error("logAudit", e);
  }
}
