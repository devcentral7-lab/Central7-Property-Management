"use client";

import { useState, useTransition } from "react";
import { saveAgent, saveTargets } from "@/app/app/finance/actions";
import { formatLkr, type FinanceAgent, type FinanceTargetRow } from "@/lib/finance-shared";

const cellInput = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm";
const th = "whitespace-nowrap pb-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]";

function parseAmount(v: string): number | null {
  const t = v.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function TargetsForm({ year, rows }: { year: number; rows: FinanceTargetRow[] }) {
  const initial = Object.fromEntries(rows.map((r) => [r.agent_id, r.target === null ? "" : String(r.target)]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = rows.some((r) => (values[r.agent_id] ?? "") !== initial[r.agent_id]);

  function copyPrevious() {
    setValues((cur) => {
      const next = { ...cur };
      for (const r of rows) {
        if (r.previous_target !== null && !next[r.agent_id]) next[r.agent_id] = String(r.previous_target);
      }
      return next;
    });
  }

  function save() {
    setMessage(null);
    const targets = rows.map((r) => ({ agent_id: r.agent_id, name: r.name, target: parseAmount(values[r.agent_id] ?? "") }));
    if (targets.some((t) => t.target !== null && (Number.isNaN(t.target) || t.target < 0))) {
      setMessage({ ok: false, text: "Targets must be positive numbers (or empty for no target)." });
      return;
    }
    startTransition(async () => {
      const result = await saveTargets(year, targets);
      setMessage(result.ok ? { ok: true, text: `${year} targets saved.` } : { ok: false, text: result.error });
    });
  }

  if (!rows.length) {
    return <p className="text-sm text-[var(--muted)]">No active sales agents. Add one below.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className={th}>Agent</th>
              <th className={`${th} w-56`}>Target {year} (LKR)</th>
              <th className={`${th} text-right`}>{year - 1} target</th>
              <th className={`${th} text-right`}>Achieved {year}</th>
              <th className={th}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const target = parseAmount(values[r.agent_id] ?? "");
              const pct = target && target > 0 ? Math.round((r.achieved / target) * 100) : null;
              return (
                <tr key={r.agent_id} className="border-t border-[var(--line)]">
                  <td className="py-2.5 pr-3 font-medium">
                    {r.name}
                    {!r.active ? <span className="ml-2 text-xs font-normal text-[var(--muted)]">(inactive)</span> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      inputMode="decimal"
                      value={values[r.agent_id] ?? ""}
                      onChange={(e) => setValues((cur) => ({ ...cur, [r.agent_id]: e.target.value }))}
                      placeholder="No target"
                      aria-label={`${r.name} target`}
                      className={`${cellInput} tabular-nums`}
                    />
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--muted)]">
                    {r.previous_target === null ? "—" : formatLkr(r.previous_target)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{formatLkr(r.achieved)}</td>
                  <td className="py-2.5">
                    {pct === null ? (
                      <span className="text-[var(--muted)]">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-accent)]">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#10b981" : "#c8102e" }}
                          />
                        </span>
                        <span className="text-xs font-semibold tabular-nums">{pct}%</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {message ? (
          <p className={`mr-auto text-sm font-medium ${message.ok ? "text-emerald-700" : "text-[var(--brand)]"}`}>
            {message.text}
          </p>
        ) : null}
        {rows.some((r) => r.previous_target !== null && !values[r.agent_id]) ? (
          <button
            type="button"
            onClick={copyPrevious}
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
          >
            Copy {year - 1} targets
          </button>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-xl bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-deep)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save targets"}
        </button>
      </div>
    </div>
  );
}

type Profile = { id: string; display_name: string };

function AgentRow({
  agent,
  profiles,
  onSaved,
}: {
  agent: FinanceAgent | null;
  profiles: Profile[];
  onSaved?: () => void;
}) {
  const [name, setName] = useState(agent?.name ?? "");
  const [profileId, setProfileId] = useState(agent?.profile_id ?? "");
  const [sales, setSales] = useState(agent?.sales_agent ?? true);
  const [active, setActive] = useState(agent?.active ?? true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = agent
    ? name !== agent.name || profileId !== (agent.profile_id ?? "") || sales !== agent.sales_agent || active !== agent.active
    : name.trim() !== "";

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAgent({
        id: agent?.id ?? null,
        name,
        profile_id: profileId || null,
        sales_agent: sales,
        active,
      });
      if (!result.ok) return setError(result.error);
      setSaved(true);
      if (!agent) {
        setName("");
        setProfileId("");
        setSales(true);
        setActive(true);
      }
      onSaved?.();
    });
  }

  return (
    <tr className="border-t border-[var(--line)] align-top">
      <td className="py-2 pr-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={agent ? "" : "New agent name"}
          aria-label="Agent name"
          className={cellInput}
        />
        {error ? <p className="mt-1 text-xs text-[var(--brand)]">{error}</p> : null}
      </td>
      <td className="py-2 pr-3">
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} aria-label="Linked login" className={cellInput}>
          <option value="">No login</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <label className="inline-flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={sales} onChange={(e) => setSales(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          {sales ? "Sales agent" : "Director"}
        </label>
      </td>
      <td className="py-2 pr-3">
        <label className="inline-flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          {active ? "Active" : "Inactive"}
        </label>
      </td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums text-[var(--muted)]">{agent ? agent.invoices : ""}</td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
            agent
              ? "border border-[var(--line)] hover:bg-[var(--bg-accent)]"
              : "bg-[var(--brand)] text-white hover:bg-[var(--brand-deep)]"
          }`}
        >
          {pending ? "Saving…" : agent ? (saved && !dirty ? "Saved" : "Save") : "Add"}
        </button>
      </td>
    </tr>
  );
}

export function AgentsManager({ agents, profiles }: { agents: FinanceAgent[]; profiles: Profile[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr>
            <th className={th}>Name</th>
            <th className={th}>Linked login</th>
            <th className={th}>Role</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Invoices</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <AgentRow key={a.id} agent={a} profiles={profiles} />
          ))}
          <AgentRow agent={null} profiles={profiles} />
        </tbody>
      </table>
    </div>
  );
}
