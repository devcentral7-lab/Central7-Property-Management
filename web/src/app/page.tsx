import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(15,107,76,0.08)_100%)]" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-display text-2xl font-semibold tracking-tight text-[var(--brand-deep)]">
          Central7
        </p>
        <div className="flex gap-3">
          <Link
            href="/search"
            className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--ink)] backdrop-blur transition hover:border-[var(--brand)]"
          >
            Search
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)]"
          >
            Staff login
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-20 pt-10">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Opportunity register
        </p>
        <h1 className="font-display max-w-3xl text-5xl font-semibold leading-[1.05] text-[var(--brand-deep)] md:text-7xl">
          Central7 Pulse
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
          Fast, secure property CRM — paginated search, authenticated workflows,
          and no more full-database downloads on login.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-full bg-[var(--brand-deep)] px-6 py-3 text-sm font-semibold text-white"
          >
            Open workspace
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-[var(--brand)] px-6 py-3 text-sm font-semibold text-[var(--brand-deep)]"
          >
            Browse listings
          </Link>
        </div>
      </section>
    </main>
  );
}
