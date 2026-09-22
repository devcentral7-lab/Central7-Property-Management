import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const actor = await getSessionActor();

  if (actor.kind === "staff") redirect("/app");
  if (actor.kind === "agent") redirect("/agent");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Signed in but neither active staff nor approved agent
  await supabase.auth.signOut();
  redirect(
    `/login?error=${encodeURIComponent(sp.error || "Account is not active or not approved.")}`,
  );
}
