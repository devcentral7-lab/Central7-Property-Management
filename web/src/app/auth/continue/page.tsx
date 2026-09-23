import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const actor = await getSessionActor();

  if (actor.kind === "staff") {
    await logAudit({
      category: "auth",
      action: "login",
      actorName: actor.profile.display_name,
      actorKind: "staff",
      subjectType: "session",
      subjectLabel: actor.profile.role,
      summary: `${actor.profile.display_name} signed in (staff · ${actor.profile.role})`,
      details: {
        role: actor.profile.role,
        profile_id: actor.profile.id,
      },
    });
    redirect("/app");
  }

  if (actor.kind === "agent") {
    const name = actor.agent.company_name || actor.agent.username;
    await logAudit({
      category: "auth",
      action: "login",
      actorName: name,
      actorKind: "agent",
      subjectType: "session",
      subjectLabel: actor.agent.username,
      summary: `${name} signed in (partner)`,
      details: {
        partner_id: actor.agent.id,
        username: actor.agent.username,
      },
    });
    redirect("/agent");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await logAudit({
    category: "auth",
    action: "login_denied",
    actorKind: "unknown",
    subjectType: "session",
    subjectLabel: user.email ?? user.id,
    summary: `Sign-in denied for ${user.email || user.id}`,
    details: { auth_user_id: user.id, email: user.email },
  });

  await supabase.auth.signOut();
  redirect(
    `/login?error=${encodeURIComponent(sp.error || "Account is not active or not approved.")}`,
  );
}
