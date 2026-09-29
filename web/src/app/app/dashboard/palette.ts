/** Central 7 brand kit: red, charcoal and warm neutrals. */
export const BRAND = {
  red: "#c8102e",
  redDeep: "#9f0c24",
  redDark: "#6e0819",
  redSoft: "#e8697d",
  redPale: "#f7d3d9",
  charcoal: "#1f1f1f",
  stone: "#78716c",
  stoneLight: "#a8a29e",
  stonePale: "#e7e5e4",
  grid: "#e5e7eb",
  axis: "#6b7280",
  active: "#10b981",
} as const;

/** Ordered so neighbouring slices/bars always contrast. */
export const SERIES = [
  BRAND.red,
  BRAND.charcoal,
  BRAND.redSoft,
  BRAND.stone,
  BRAND.redDark,
  BRAND.stoneLight,
  BRAND.redPale,
  "#44403c",
];

const STATUS_COLORS: Record<string, string> = {
  Active: BRAND.active,
  Hold: BRAND.redSoft,
  Closed: BRAND.redDark,
  Lost: BRAND.charcoal,
  Drop: BRAND.stone,
  Obsolete: BRAND.stoneLight,
};

export function statusColor(name: string, index: number): string {
  return STATUS_COLORS[name] ?? SERIES[index % SERIES.length];
}

export function seriesColor(index: number): string {
  return SERIES[index % SERIES.length];
}

/** Leader in red, runner-up charcoal, the rest stone. */
export function rankColors(n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? BRAND.red : i === 1 ? BRAND.charcoal : BRAND.stone,
  );
}
