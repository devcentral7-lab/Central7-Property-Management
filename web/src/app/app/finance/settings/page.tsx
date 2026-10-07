import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { currentYear, loadFinanceAgents, loadTargets } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { FinanceHeader } from "@/app/app/finance/finance-ui";
import { AgentsManager, TargetsForm } from "./settings-forms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinanceSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (profile.role !== "Admin") redirect("/app");
  const sp = await searchParams;
  const now = currentYear();
  const requested = Number(typeof sp.year === "string" ? sp.year : "");
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : now;

  const supabase = await createClient();
  const [targets, agents, { data: profiles }] = await Promise.all([
    loadTargets(year),
    loadFinanceAgents(),
    supabase.from("profiles").select("id, display_name").eq("active", true).order("display_name"),
  ]);

  const years = [now + 1, now, now - 1, now - 2, now - 3];

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <FinanceHeader title="Targets & agents" back={{ href: "/app/finance", label: "Finance" }} />

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Yearly targets</h2>
            <p className="text-xs text-[var(--muted)]">Commission target per sales agent. Directors don&apos;t have targets.</p>
          </div>
          <div className="tab-scroll">
            {years.map((y) => (
              <Link
                key={y}
                href={`/app/finance/settings?year=${y}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  y === year
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)]"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <TargetsForm key={year} year={year} rows={targets} />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
          <h2 className="font-display text-lg font-semibold">Agents</h2>
          <p className="text-xs text-[var(--muted)]">
            People commission can be credited to. Inactive agents keep their history but can&apos;t be picked on new invoices.
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <AgentsManager agents={agents} profiles={(profiles ?? []) as { id: string; display_name: string }[]} />
        </div>
      </section>
    </div>
  );
}
