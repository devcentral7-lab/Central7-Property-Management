"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { DayCount, NamedCount } from "@/lib/analytics";
import { BRAND } from "@/app/app/dashboard/palette";

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

type TipLine = { label: string; value: string; color?: string };
type TipState = { x: number; y: number; w: number; title: string; lines: TipLine[] } | null;

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState>(null);
  function show(e: PointerEvent, title: string, lines: TipLine[]) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, title, lines });
  }
  return { ref, tip, show, hide: () => setTip(null) };
}

function Tooltip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  const half = 80;
  const left = Math.min(Math.max(tip.x, half), Math.max(half, tip.w - half));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-[140px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-[var(--sidebar)] px-3 py-2 text-xs text-white shadow-xl"
      style={{ left, top: tip.y }}
    >
      <p className="font-semibold">{tip.title}</p>
      {tip.lines.map((l) => (
        <p key={l.label} className="mt-1 flex items-center justify-between gap-4 text-white/80">
          <span className="flex items-center gap-1.5">
            {l.color ? (
              <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
            ) : null}
            {l.label}
          </span>
          <span className="font-semibold tabular-nums text-white">{l.value}</span>
        </p>
      ))}
    </div>
  );
}

function pctText(part: number, total: number) {
  if (!total) return "0%";
  const p = (part / total) * 100;
  return p > 0 && p < 0.1 ? "<0.1%" : `${p.toFixed(1)}%`;
}

function EmptyChart({ label, className = "h-[240px]" }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center text-sm text-[var(--muted)] ${className}`}>
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export function DonutChart({
  data,
  colors,
  unit = "listings",
}: {
  data: NamedCount[];
  colors: string[];
  unit?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { ref, tip, show, hide } = useTip();
  if (!data.length) return <EmptyChart label="No data yet" />;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = 120;
  const cy = 120;
  const r = 82;
  const stroke = 26;
  const gap = data.length > 1 ? 0.012 : 0;
  const starts = data.reduce<number[]>((acc, d, i) => {
    acc.push(i === 0 ? -Math.PI / 2 : acc[i - 1] + (data[i - 1].value / total) * Math.PI * 2);
    return acc;
  }, []);

  const current = active != null ? data[active] : null;

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <svg
          viewBox="0 0 240 240"
          className="h-[200px] w-[200px] shrink-0 sm:h-[220px] sm:w-[220px]"
          role="img"
          aria-label={`${total.toLocaleString()} ${unit}`}
          onPointerLeave={() => {
            setActive(null);
            hide();
          }}
        >
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={BRAND.stonePale} strokeWidth={stroke} />
          {data.map((d, i) => {
            const sweep = (d.value / total) * Math.PI * 2;
            if (sweep <= 0) return null;
            const trim = sweep > gap * 2 ? gap : 0;
            const a0 = starts[i] + trim;
            const a1 = starts[i] + sweep - trim;
            const full = sweep >= Math.PI * 2 - 1e-6;
            const isActive = active === i;
            const dim = active != null && !isActive;
            const common = {
              fill: "none",
              stroke: colors[i],
              strokeWidth: isActive ? stroke + 8 : stroke,
              opacity: dim ? 0.3 : 1,
              className: "cursor-pointer transition-all duration-150",
              onPointerMove: (e: PointerEvent) => {
                setActive(i);
                show(e, d.name, [
                  { label: "Listings", value: d.value.toLocaleString(), color: colors[i] },
                  { label: "Share", value: pctText(d.value, total) },
                ]);
              },
            };
            if (full) return <circle key={d.name} cx={cx} cy={cy} r={r} {...common} />;
            const x1 = cx + r * Math.cos(a0);
            const y1 = cy + r * Math.sin(a0);
            const x2 = cx + r * Math.cos(a1);
            const y2 = cy + r * Math.sin(a1);
            const large = a1 - a0 > Math.PI ? 1 : 0;
            return (
              <path
                key={d.name}
                d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                {...common}
              />
            );
          })}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill={current ? colors[active!] : BRAND.charcoal}
            style={{ fontSize: current ? 24 : 26, fontWeight: 700 }}
          >
            {(current?.value ?? total).toLocaleString()}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill={BRAND.axis} style={{ fontSize: 11 }}>
            {current ? `${current.name} · ${pctText(current.value, total)}` : unit}
          </text>
        </svg>

        <ul className="grid w-full min-w-0 flex-1 gap-1">
          {data.map((d, i) => {
            const dim = active != null && active !== i;
            return (
              <li key={d.name}>
                <button
                  type="button"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    active === i ? "bg-[var(--bg-accent)]" : ""
                  } ${dim ? "opacity-45" : ""}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[i] }} />
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  <span className="font-semibold tabular-nums">{d.value.toLocaleString()}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-[var(--muted)]">
                    {pctText(d.value, total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars                                                     */
/* ------------------------------------------------------------------ */

export function HBarChart({
  data,
  colors,
  ranked = false,
  unit = "Listings",
  emptyLabel = "No data yet",
}: {
  data: NamedCount[];
  colors: string[];
  ranked?: boolean;
  unit?: string;
  emptyLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { ref, tip, show, hide } = useTip();
  if (!data.length) return <EmptyChart label={emptyLabel} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div
      ref={ref}
      className="relative flex min-h-[240px] flex-col justify-center gap-1"
      onPointerLeave={() => {
        setActive(null);
        hide();
      }}
    >
      {data.map((d, i) => {
        const dim = active != null && active !== i;
        return (
          <div
            key={d.name}
            onPointerMove={(e) => {
              setActive(i);
              show(e, d.name, [
                { label: unit, value: d.value.toLocaleString(), color: colors[i] },
                { label: "Share", value: pctText(d.value, total) },
              ]);
            }}
            className={`grid cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 transition ${
              ranked
                ? "grid-cols-[18px_88px_1fr_48px] sm:grid-cols-[18px_120px_1fr_52px]"
                : "grid-cols-[96px_1fr_52px] sm:grid-cols-[130px_1fr_56px]"
            } ${active === i ? "bg-[var(--bg-accent)]" : ""} ${dim ? "opacity-50" : ""}`}
          >
            {ranked ? (
              <span className="text-xs font-semibold tabular-nums text-[var(--muted)]">{i + 1}</span>
            ) : null}
            <span className="truncate text-sm">{d.name}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-accent)]">
              <div
                className="h-full rounded-full transition-[width,filter] duration-300"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: colors[i],
                  filter: active === i ? "brightness(1.1)" : undefined,
                }}
              />
            </div>
            <span className="text-right text-sm font-semibold tabular-nums">
              {d.value.toLocaleString()}
            </span>
          </div>
        );
      })}
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked horizontal bars                                             */
/* ------------------------------------------------------------------ */

export function StackedBarChart({
  rows,
  keys,
  colors,
  percent = false,
}: {
  rows: { label: string; values: Record<string, number> }[];
  keys: string[];
  colors: string[];
  percent?: boolean;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const { ref, tip, show, hide } = useTip();
  if (!rows.length) return <EmptyChart label="No data yet" />;

  const totals = rows.map((r) => keys.reduce((s, k) => s + (r.values[k] ?? 0), 0));
  const max = Math.max(...totals, 1);

  return (
    <div ref={ref} className="relative">
      <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {keys.map((k, i) => (
          <li key={k}>
            <button
              type="button"
              onPointerEnter={() => setActiveKey(k)}
              onPointerLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(k)}
              onBlur={() => setActiveKey(null)}
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition ${
                activeKey && activeKey !== k ? "opacity-40" : ""
              } ${activeKey === k ? "bg-[var(--bg-accent)]" : ""}`}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} />
              {k}
            </button>
          </li>
        ))}
      </ul>
      <div
        className="flex flex-col gap-1"
        onPointerLeave={() => {
          setActiveKey(null);
          setActiveRow(null);
          hide();
        }}
      >
        {rows.map((r, ri) => {
          const total = totals[ri];
          const width = percent ? 100 : (total / max) * 100;
          return (
            <div
              key={r.label}
              className={`grid grid-cols-[88px_1fr_52px] items-center gap-2.5 rounded-lg px-2 py-1.5 transition sm:grid-cols-[120px_1fr_56px] ${
                activeRow === r.label ? "bg-[var(--bg-accent)]" : ""
              }`}
            >
              <span className="truncate text-sm">{r.label}</span>
              <div className="h-3.5 overflow-hidden rounded-full bg-[var(--bg-accent)]">
                <div className="flex h-full" style={{ width: `${width}%` }}>
                  {keys.map((k, ki) => {
                    const v = r.values[k] ?? 0;
                    if (!v) return null;
                    const dim = activeKey != null && activeKey !== k;
                    return (
                      <div
                        key={k}
                        className="h-full cursor-default transition-opacity first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(v / total) * 100}%`,
                          background: colors[ki],
                          opacity: dim ? 0.25 : 1,
                        }}
                        onPointerMove={(e) => {
                          setActiveKey(k);
                          setActiveRow(r.label);
                          show(e, r.label, [
                            { label: k, value: v.toLocaleString(), color: colors[ki] },
                            { label: `Share of ${r.label}`, value: pctText(v, total) },
                            { label: "Row total", value: total.toLocaleString() },
                          ]);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <span className="text-right text-sm font-semibold tabular-nums">
                {total.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column chart                                                        */
/* ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  colors,
  unit = "Listings",
}: {
  data: NamedCount[];
  colors: string[];
  unit?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { ref, tip, show, hide } = useTip();
  if (!data.length) return <EmptyChart label="No data yet" />;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div
      ref={ref}
      className="relative"
      onPointerLeave={() => {
        setActive(null);
        hide();
      }}
    >
      <div className="flex h-[210px] items-end gap-2 border-b border-[var(--line)] px-1 sm:gap-3">
        {data.map((d, i) => {
          const dim = active != null && active !== i;
          const h = (d.value / max) * 100;
          return (
            <div
              key={d.name}
              className="flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end"
              onPointerMove={(e) => {
                setActive(i);
                const total = data.reduce((s, x) => s + x.value, 0);
                show(e, d.name, [
                  { label: unit, value: d.value.toLocaleString(), color: colors[i] },
                  { label: "Share", value: pctText(d.value, total) },
                ]);
              }}
            >
              <span
                className={`mb-1 text-xs font-semibold tabular-nums transition ${
                  active === i ? "text-[var(--ink)]" : "text-[var(--muted)]"
                }`}
              >
                {d.value.toLocaleString()}
              </span>
              <div
                className="w-full max-w-[56px] rounded-t-md transition-all duration-300"
                style={{
                  height: `${Math.max(h, d.value ? 2 : 0)}%`,
                  background: colors[i],
                  opacity: dim ? 0.35 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 px-1 sm:gap-3">
        {data.map((d, i) => (
          <span
            key={d.name}
            className={`min-w-0 flex-1 truncate text-center text-xs ${
              active === i ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"
            }`}
          >
            {d.name}
          </span>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend line                                                          */
/* ------------------------------------------------------------------ */

function formatDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function formatMonth(day: string, long = false) {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
    timeZone: "UTC",
  });
}

export function TrendChart({ data, unit = "day" }: { data: DayCount[]; unit?: "day" | "month" }) {
  const perMonth = unit === "month";
  const label = (day: string, long = false) => (perMonth ? formatMonth(day, long) : formatDay(day));
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const { ref, tip, show, hide } = useTip();
  if (!data.length) return <EmptyChart label="No data yet" />;

  const w = 640;
  const h = 240;
  const pad = { t: 16, r: 14, b: 28, l: 36 };
  const max = Math.max(...data.map((d) => d.count), 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const xAt = (i: number) =>
    pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (v / max) * innerH;
  const points = data.map((d, i) => ({ x: xAt(i), y: yAt(d.count), ...d }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x} ${pad.t + innerH} L ${pad.l} ${pad.t + innerH} Z`;
  const total = data.reduce((s, d) => s + d.count, 0);
  const avg = total / data.length;
  const step = Math.max(1, Math.ceil(points.length / 7));

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const ratio = (pt.x - pad.l) / innerW;
    const i = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
    setActive(i);
    const d = data[i];
    show(e, label(d.day, true), [
      { label: "Added", value: d.count.toLocaleString(), color: BRAND.red },
      { label: "Period average", value: avg.toFixed(1) },
    ]);
  }

  const a = active != null ? points[active] : null;

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
        <span>
          Total <span className="font-semibold tabular-nums text-[var(--ink)]">{total.toLocaleString()}</span>
        </span>
        <span>
          {perMonth ? "Monthly" : "Daily"} average{" "}
          <span className="font-semibold tabular-nums text-[var(--ink)]">{avg.toFixed(1)}</span>
        </span>
        <span>
          Busiest {perMonth ? "month" : "day"}{" "}
          <span className="font-semibold tabular-nums text-[var(--ink)]">{max.toLocaleString()}</span>
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="h-[210px] w-full touch-pan-y sm:h-[250px]"
        role="img"
        aria-label={`Listings added per ${unit}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => {
          setActive(null);
          hide();
        }}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BRAND.red} stopOpacity={0.22} />
            <stop offset="100%" stopColor={BRAND.red} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke={BRAND.grid} strokeDasharray="3 3" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fill={BRAND.axis} fontSize={10}>
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}
        <line
          x1={pad.l}
          x2={w - pad.r}
          y1={yAt(avg)}
          y2={yAt(avg)}
          stroke={BRAND.charcoal}
          strokeOpacity={0.35}
          strokeDasharray="6 4"
        />
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke={BRAND.red} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {a ? (
          <g pointerEvents="none">
            <line x1={a.x} x2={a.x} y1={pad.t} y2={pad.t + innerH} stroke={BRAND.charcoal} strokeOpacity={0.25} />
            <circle cx={a.x} cy={a.y} r={5} fill="#fff" stroke={BRAND.red} strokeWidth={2.5} />
          </g>
        ) : null}
        {points
          .filter((_, i) => (i % step === 0 && points.length - 1 - i >= step / 2) || i === points.length - 1)
          .map((p) => (
            <text key={p.day} x={p.x} y={h - 8} textAnchor="middle" fill={BRAND.axis} fontSize={10}>
              {label(p.day)}
            </text>
          ))}
        <rect x={pad.l} y={pad.t} width={innerW} height={innerH} fill="transparent" />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers for callers                                                 */
/* ------------------------------------------------------------------ */

export function ChartNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-[var(--muted)]">{children}</p>;
}
