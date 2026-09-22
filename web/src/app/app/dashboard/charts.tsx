import type { DayCount, NamedCount } from "@/lib/analytics";

const COLORS = [
  "#0f6b4c",
  "#c45c26",
  "#0a4633",
  "#5c6b62",
  "#2a8f6a",
  "#a33b3b",
  "#8a6d3b",
  "#3d5a80",
];

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-[var(--muted)]">
      {label}
    </div>
  );
}

/** Donut via SVG arcs — server-rendered (no client hydration). */
export function StatusDonut({ data }: { data: NamedCount[] }) {
  if (!data.length) return <EmptyChart label="No status data" />;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = 120;
  const cy = 120;
  const r = 78;
  const stroke = 28;
  let angle = -Math.PI / 2;

  const arcs = data
    .map((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2;
      if (sweep <= 0) return null;
      if (sweep >= Math.PI * 2 - 1e-6) {
        return {
          full: true as const,
          color: COLORS[i % COLORS.length],
          name: d.name,
          value: d.value,
        };
      }
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += sweep;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      return {
        full: false as const,
        d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
        color: COLORS[i % COLORS.length],
        name: d.name,
        value: d.value,
      };
    })
    .filter(Boolean);

  return (
    <div className="flex h-[260px] items-center justify-center gap-6">
      <svg
        width="240"
        height="240"
        viewBox="0 0 240 240"
        role="img"
        aria-label={`Status mix, ${total.toLocaleString()} listings`}
      >
        {arcs.map((a) =>
          a!.full ? (
            <circle
              key={a!.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a!.color}
              strokeWidth={stroke}
              aria-label={`${a!.name}: ${a!.value.toLocaleString()}`}
            />
          ) : (
            <path
              key={a!.name}
              d={a!.d}
              fill="none"
              stroke={a!.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              aria-label={`${a!.name}: ${a!.value.toLocaleString()}`}
            />
          ),
        )}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#14221b"
          style={{ fontSize: 22, fontWeight: 600 }}
        >
          {total.toLocaleString()}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fill="#5c6b62"
          style={{ fontSize: 11 }}
        >
          listings
        </text>
      </svg>
    </div>
  );
}

export function TypeBars({ data }: { data: NamedCount[] }) {
  if (!data.length) return <EmptyChart label="No type data" />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-[260px] flex-col justify-end gap-3 py-2">
      {data.map((d, i) => (
        <div
          key={d.name}
          className="grid grid-cols-[110px_1fr_48px] items-center gap-2"
        >
          <span className="truncate text-xs text-[var(--muted)]">{d.name}</span>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-accent)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: COLORS[i % COLORS.length],
              }}
            />
          </div>
          <span className="text-right text-xs font-semibold tabular-nums">
            {d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ListingsTrend({ data }: { data: DayCount[] }) {
  const w = 560;
  const h = 240;
  const pad = { t: 16, r: 12, b: 28, l: 36 };
  const max = Math.max(...data.map((d) => d.count), 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const points = data.map((d, i) => {
    const x =
      pad.l +
      (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = pad.t + innerH - (d.count / max) * innerH;
    return { x, y, ...d };
  });
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const area = `${line} L ${points[points.length - 1]?.x ?? pad.l} ${pad.t + innerH} L ${pad.l} ${pad.t + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[260px] w-full"
      role="img"
      aria-label="Listings added over the last 30 days"
    >
      {[0, 0.5, 1].map((t) => {
        const y = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={y}
              y2={y}
              stroke="#d5ddd6"
              strokeDasharray="3 3"
            />
            <text
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
              fill="#5c6b62"
              fontSize={10}
            >
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="#0f6b4c" fillOpacity={0.12} />
      <path d={line} fill="none" stroke="#0f6b4c" strokeWidth={2} />
      {points
        .filter((_, i) => i % 5 === 0 || i === points.length - 1)
        .map((p) => (
          <text
            key={p.day}
            x={p.x}
            y={h - 8}
            textAnchor="middle"
            fill="#5c6b62"
            fontSize={10}
          >
            {p.day.slice(5)}
          </text>
        ))}
    </svg>
  );
}

export function CreatorBars({ data }: { data: NamedCount[] }) {
  if (!data.length) return <EmptyChart label="No creator activity in range" />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-[280px] flex-col justify-center gap-3 py-2">
      {data.map((d) => (
        <div
          key={d.name}
          className="grid grid-cols-[100px_1fr_40px] items-center gap-2"
        >
          <span className="truncate text-xs text-[var(--muted)]">{d.name}</span>
          <div className="h-3.5 overflow-hidden rounded-full bg-[var(--bg-accent)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: "#c45c26",
              }}
            />
          </div>
          <span className="text-right text-xs font-semibold tabular-nums">
            {d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
