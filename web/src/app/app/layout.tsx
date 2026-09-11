import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { signOut } from "@/app/app/actions";

const nav = [
  { href: "/app", label: "Home" },
  { href: "/app/properties", label: "Properties" },
  { href: "/app/properties/new", label: "Add listing" },
  { href: "/app/my-properties", label: "My properties" },
  { href: "/app/activity", label: "Activity log" },
  { href: "/app/social-queue", label: "Social queue" },
  { href: "/app/republish-queue", label: "Republish" },
  { href: "/app/agents", label: "Partners" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile;
  try {
    profile = await requireProfile();
  } catch {
    redirect("/login?next=/app");
  }

  const items =
    profile.role === "Admin"
      ? nav
      : nav.filter((n) => !["/app/agents"].includes(n.href));

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link href="/app" className="font-display text-xl font-semibold text-[var(--brand-deep)]">
              Central7 Pulse
            </Link>
            <p className="text-xs text-[var(--muted)]">
              {profile.display_name} · {profile.role}
            </p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
