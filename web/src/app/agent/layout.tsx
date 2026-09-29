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

  const name = agent.company_name || agent.contact_person || agent.username;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-7xl px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
          <Link href="/agent" className="flex min-w-0 items-center gap-3" aria-label="Central7 Pulse home">
            <BrandLogo size={40} />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-semibold text-[var(--brand-deep)] sm:text-xl">
                Central7 Pulse
              </span>
              <span className="block truncate text-xs text-[var(--muted)]">{name} · Partner</span>
            </span>
          </Link>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"
                />
              </svg>
              Log out
            </button>
          </form>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
