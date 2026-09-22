import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAgent } from "@/lib/auth";
import { signOut } from "@/app/app/actions";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let agent;
  try {
    agent = await requireAgent();
  } catch {
    redirect("/auth/continue");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link
              href="/agent"
              className="font-display text-xl font-semibold text-[var(--brand-deep)]"
            >
              Central7 Pulse
            </Link>
            <p className="text-xs text-[var(--muted)]">
              {agent.company_name || agent.username} · Partner
            </p>
          </div>
          <nav className="flex flex-wrap gap-1">
            <Link
              href="/agent"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
            >
              Search
            </Link>
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
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
