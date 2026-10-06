import type { ReactNode } from "react";

export const fieldClass =
  "mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15";

export const labelClass = "block text-sm font-medium";

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-stone-200 text-stone-700",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  square = false,
  className = "",
}: {
  name: string;
  size?: "md" | "lg";
  square?: boolean;
  className?: string;
}) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : "h-9 w-9 text-xs";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-bold ${square ? "rounded-xl" : "rounded-full"} ${dims} ${tone} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "brand" | "neutral" | "green" | "amber" | "red";
  children: ReactNode;
}) {
  const tones = {
    brand: "bg-[var(--brand)]/10 text-[var(--brand-deep)] ring-[var(--brand)]/20",
    neutral: "bg-stone-100 text-stone-600 ring-stone-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: IconName;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ${
        accent
          ? "border-transparent bg-[var(--sidebar)] text-white"
          : "border-[var(--line)] bg-[var(--card)]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          accent ? "bg-white/10 text-white" : "bg-[var(--brand)]/10 text-[var(--brand)]"
        }`}
      >
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${accent ? "text-white/70" : "text-[var(--muted)]"}`}>
          {label}
        </p>
        <p className="font-display text-2xl font-semibold tabular-nums leading-tight">
          {value.toLocaleString()}
        </p>
        {hint ? (
          <p className={`truncate text-xs ${accent ? "text-white/60" : "text-[var(--muted)]"}`}>{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--muted)]">{description}</span>
        ) : null}
      </span>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-stone-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand)]/40"
      />
    </label>
  );
}

export const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--bg-accent)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-35";

export const dangerIconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-red-50 hover:text-[var(--danger)] disabled:pointer-events-none disabled:opacity-35";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-deep)] disabled:cursor-wait disabled:opacity-70";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-accent)] disabled:opacity-50";

export function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[var(--ink)] text-white"
          : "text-[var(--muted)] ring-1 ring-inset ring-[var(--line)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
      {count !== undefined ? (
        <span className={`tabular-nums ${active ? "text-white/70" : "text-[var(--muted)]"}`}>{count}</span>
      ) : null}
    </button>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">Search</span>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-[var(--line)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
      />
    </label>
  );
}

export type IconName =
  | "users"
  | "shield"
  | "check"
  | "pause"
  | "building"
  | "clock"
  | "key"
  | "edit"
  | "trash"
  | "plus"
  | "search"
  | "mail"
  | "phone"
  | "link"
  | "userPlus"
  | "eye"
  | "eyeOff"
  | "calendar"
  | "logout"
  | "lock"
  | "pin";

const PATHS: Record<IconName, ReactNode> = {
  users: (
    <>
      <circle cx="8" cy="7" r="3" />
      <path d="M2.5 16.5a5.5 5.5 0 0 1 11 0M13.5 4.2a3 3 0 0 1 0 5.6M15.5 12a5.5 5.5 0 0 1 2.5 4.5" />
    </>
  ),
  shield: <path d="M10 2.5 4 5v4.5c0 3.8 2.6 6.9 6 8 3.4-1.1 6-4.2 6-8V5l-6-2.5Z M7.5 10l1.8 1.8L12.8 8.3" />,
  check: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.8 10.2 2.2 2.2 4.2-4.6" />
    </>
  ),
  pause: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M8.3 7.3v5.4M11.7 7.3v5.4" />
    </>
  ),
  building: <path d="M3.5 17.5h13M5 17.5V4.5A1 1 0 0 1 6 3.5h5a1 1 0 0 1 1 1v13M12 8h2a1 1 0 0 1 1 1v8.5M7.5 6.5h2M7.5 9.5h2M7.5 12.5h2" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l2.5 2" />
    </>
  ),
  key: (
    <>
      <circle cx="6.5" cy="13.5" r="3" />
      <path d="m8.7 11.3 7.3-7.3M13.5 6.5l2 2M11.5 8.5l1.5 1.5" />
    </>
  ),
  edit: <path d="M12.5 4.5 15.5 7.5M4 16l.8-3.6 8.9-8.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.9 8.9L4 16Z" />,
  trash: <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4l.8-10M8.5 9v5M11.5 9v5" />,
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13 13 3.5 3.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="4.5" width="14" height="11" rx="2" />
      <path d="m3.5 6 6.5 5 6.5-5" />
    </>
  ),
  phone: <path d="M5 3.5h2.5l1.2 3.2-1.6 1.1a8.5 8.5 0 0 0 5.1 5.1l1.1-1.6 3.2 1.2V15a1.5 1.5 0 0 1-1.6 1.5A12.5 12.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5Z" />,
  link: <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" />,
  userPlus: (
    <>
      <circle cx="8" cy="7" r="3" />
      <path d="M2.5 16.5a5.5 5.5 0 0 1 11 0M15.5 6.5v5M13 9h5" />
    </>
  ),
  eye: (
    <>
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
  eyeOff: <path d="M3 3l14 14M8.2 5a8.6 8.6 0 0 1 1.8-.2c5.2 0 8.2 5.2 8.2 5.2a14 14 0 0 1-2.2 2.8M12.1 12.2A2.5 2.5 0 0 1 7.8 7.9M5.4 6.3A13.7 13.7 0 0 0 1.8 10S4.8 15.2 10 15.2a8 8 0 0 0 3.6-.8" />,
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3" />
    </>
  ),
  logout: <path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3M12.5 13.5 16 10l-3.5-3.5M16 10H7.5" />,
  lock: (
    <>
      <rect x="4" y="8.5" width="12" height="8.5" rx="2" />
      <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5M10 12v2" />
    </>
  ),
  pin: (
    <>
      <path d="M10 17.5s5.5-5 5.5-9.5a5.5 5.5 0 0 0-11 0c0 4.5 5.5 9.5 5.5 9.5Z" />
      <circle cx="10" cy="8" r="2" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

const JOINED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

export function formatJoined(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : JOINED.format(d);
}
