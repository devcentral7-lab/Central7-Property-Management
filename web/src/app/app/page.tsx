import Link from "next/link";
import { canAccessSocialQueue, requireProfile } from "@/lib/auth";
import { loadAdminAnalytics } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/app/app/dashboard/admin-dashboard";

export default async function AppHomePage() {
  const profile = await requireProfile();

  if (profile.role === "Admin") {
    try {
      const data = await loadAdminAnalytics();
      return <AdminDashboard data={data} name={profile.display_name} />;
    } catch (e) {
      return (
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--brand-deep)]">
            Operations overview
          </h1>
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {e instanceof Error ? e.message : "Could not load analytics."}
          </p>
        </div>
      );
    }
  }

  const supabase = await createClient();
  const socialOk = await canAccessSocialQueue(profile);

  const [{ count: myCount }, { count: activeCount }, smqResult] =
    await Promise.all([
      supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("created_by_name", profile.display_name),
      supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("status", "Active"),
      socialOk
        ? supabase
            .from("social_media_queue")
            .select("*", { count: "exact", head: true })
            .is("completed_at", null)
        : Promise.resolve({ count: null }),
    ]);

  const cards = [
    { label: "My listings", value: myCount ?? 0, href: "/app/my-properties" },
    {
      label: "Active inventory",
      value: activeCount ?? 0,
      href: "/app/properties?status=Active",
    },
    ...(socialOk
      ? [
          {
            label: "Social queue open",
            value: smqResult.count ?? 0,
            href: "/app/social-queue",
          },
        ]
      : []),
  ];

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold text-[var(--brand-deep)]">
        Welcome, {profile.display_name}
      </h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Slim bootstrap only — counts and navigation. Property rows load when you
        open a list, never the full database.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 transition hover:border-[var(--brand)]"
          >
            <p className="text-sm text-[var(--muted)]">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">
              {(c.value ?? 0).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/app/listings"
          className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Add listing
        </Link>
        <Link
          href="/app/properties"
          className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold"
        >
          Search properties
        </Link>
      </div>
    </div>
  );
}
