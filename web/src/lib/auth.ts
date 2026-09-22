import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type AgentAccount = {
  id: string;
  username: string;
  company_name: string | null;
  contact_person: string | null;
  status: "Pending" | "Approved" | "Rejected";
  active: boolean;
};

export type SessionActor =
  | { kind: "staff"; profile: Profile }
  | { kind: "agent"; agent: AgentAccount }
  | { kind: "none" };

export async function getSessionActor(): Promise<SessionActor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "none" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, mobile_number, role, photo_drive_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.active) {
    return { kind: "staff", profile: profile as Profile };
  }

  const { data: agent } = await supabase
    .from("users")
    .select("id, username, company_name, contact_person, status, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (agent && agent.status === "Approved" && agent.active) {
    return { kind: "agent", agent: agent as AgentAccount };
  }

  return { kind: "none" };
}

export async function requireProfile(): Promise<Profile> {
  const actor = await getSessionActor();
  if (actor.kind !== "staff") throw new Error("Unauthorized");
  return actor.profile;
}

export async function requireAgent(): Promise<AgentAccount> {
  const actor = await getSessionActor();
  if (actor.kind !== "agent") throw new Error("Unauthorized");
  return actor.agent;
}

export async function getOptionalProfile(): Promise<Profile | null> {
  const actor = await getSessionActor();
  return actor.kind === "staff" ? actor.profile : null;
}

export async function canAccessSocialQueue(profile: Profile): Promise<boolean> {
  if (profile.role === "Admin") return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_access_social_media_queue");
  return Boolean(data);
}
