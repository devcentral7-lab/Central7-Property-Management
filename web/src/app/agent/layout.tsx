import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
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
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--card)]/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/agent" className="shrink-0" aria-label="Central7 Pulse home">
              <BrandLogo size={38} />
            </Link>
            <div className="min-w-0">
              <Link
                href="/agent"
                className="font-display text-lg font-semibold text-[var(--brand-deep)] sm:text-xl"
              >
                Central7 Pulse
              </Link>
              <p className="truncate text-xs text-[var(--muted)]">
                {agent.company_name || agent.username} · Partner
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <nav className="hidden gap-1 sm:flex">
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
                className="rounded-full border border-[var(--line)] px-3 py-2 text-sm font-medium sm:py-1.5"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">{children}</main>
    </div>
  );
}
