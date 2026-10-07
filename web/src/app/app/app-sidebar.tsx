"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { usePendingNavigation } from "./navigation-pending";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon:
    | "home"
    | "search"
    | "plus"
    | "folder"
    | "check"
    | "publish"
    | "users"
    | "agents"
    | "building"
    | "map"
    | "activity"
    | "queue"
    | "finance"
    | "account";
  match?: "exact" | "prefix";
};

const icons: Record<SidebarNavItem["icon"], ReactNode> = {
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
    />
  ),
  search: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
    />
  ),
  plus: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  ),
  folder: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
    />
  ),
  check: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.5 11 14.5 15.5 10M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  ),
  publish: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 4v12m0-12 4 4m-4-4L8 8"
    />
  ),
  users: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
    />
  ),
  agents: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 0a3 3 0 1 0 0-6"
    />
  ),
  building: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 21h16M6 21V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v17M15 9h3a1 1 0 0 1 1 1v11M9 7h3M9 11h3M9 15h3"
    />
  ),
  map: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
    />
  ),
  activity: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12h4l3 8 4-16 3 8h4"
    />
  ),
  queue: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 12h16M4 18h10"
    />
  ),
  finance: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h3"
    />
  ),
  account: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z"
    />
  ),
};

function hrefParts(href: string) {
  const [path, query = ""] = href.split("?");
  return { path, params: new URLSearchParams(query) };
}

function isActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: SidebarNavItem,
) {
  const { path, params } = hrefParts(item.href);

  if (item.match === "exact") {
    if (pathname !== path) return false;
    for (const [k, v] of params.entries()) {
      if (searchParams.get(k) !== v) return false;
    }
    if (![...params.keys()].length && searchParams.get("tab")) return false;
    if (![...params.keys()].length && searchParams.get("status")) return false;
    return true;
  }

  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;

  for (const [k, v] of params.entries()) {
    if (searchParams.get(k) !== v) return false;
  }

  if (
    path === "/app/user-management" &&
    !params.has("tab") &&
    searchParams.get("tab")
  ) {
    return false;
  }

  return true;
}

type Props = {
  items: SidebarNavItem[];
  displayName: string;
  role: string;
  signOutAction: () => Promise<void>;
  initialCollapsed?: boolean;
};

function Brand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link
        href="/app"
        aria-label="Central7 Pulse home"
        title="Central7 Pulse"
        className="shrink-0"
      >
        <BrandLogo size={36} />
      </Link>
    );
  }
  return (
    <>
      <BrandLogo size={36} />
      <Link
        href="/app"
        className="truncate whitespace-nowrap font-display text-lg font-semibold tracking-tight text-white"
      >
        Central7 Pulse
      </Link>
    </>
  );
}

function NavPanel({
  items,
  displayName,
  role,
  signOutAction,
  pathname,
  searchParams,
  collapsed = false,
}: Props & {
  pathname: string;
  searchParams: URLSearchParams;
  collapsed?: boolean;
}) {
  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {items.map((item) => {
          const active = isActive(pathname, searchParams, item);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium whitespace-nowrap transition ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-[var(--brand)] text-white shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5 shrink-0"
                aria-hidden
              >
                {icons[item.icon]}
              </svg>
              {collapsed ? null : item.label}
            </Link>
          );
        })}
      </nav>

      {collapsed ? (
        <div className="flex flex-col items-center gap-3 border-t border-white/10 px-3 py-4">
          <span
            title={`${displayName} · ${role}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <form action={signOutAction} className="w-full">
            <button
              type="submit"
              title="Log out"
              aria-label="Log out"
              className="flex h-10 w-full items-center justify-center rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--brand-deep)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"
                />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <div className="border-t border-white/10 px-4 py-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-white/55">
                Logged in as: {role}
              </p>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full whitespace-nowrap rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
            >
              Log Out
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={`${label} (Ctrl+B)`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m11 17-5-5 5-5M18 17l-5-5 5-5"
        />
      </svg>
    </button>
  );
}

function SidebarInner(props: Props) {
  const currentPath = usePathname();
  const currentParams = useSearchParams();
  const pendingUrl = usePendingNavigation();
  const pathname = pendingUrl?.pathname ?? currentPath;
  const searchParams = pendingUrl?.searchParams ?? currentParams;
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === routeKey;
  const setOpen = (next: boolean) => setOpenAt(next ? routeKey : null);
  const [collapsed, setCollapsed] = useState(Boolean(props.initialCollapsed));

  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "b") {
        const t = e.target as HTMLElement | null;
        if (t?.closest("input, textarea, select, [contenteditable='true']")) {
          return;
        }
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenAt(null);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-ink)] transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <div
          className={`flex overflow-hidden border-b border-white/10 ${
            collapsed
              ? "flex-col items-center gap-2 px-3 py-4"
              : "items-center gap-3 py-5 pl-5 pr-3"
          }`}
        >
          {collapsed ? (
            <Brand compact />
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Brand />
            </div>
          )}
          <CollapseToggle
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
          />
        </div>
        <NavPanel
          {...props}
          pathname={pathname}
          searchParams={searchParams}
          collapsed={collapsed}
        />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-[var(--sidebar)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Brand />
        </div>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="-mr-1 flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6"
            aria-hidden
          >
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-[var(--sidebar)] pb-[env(safe-area-inset-bottom)] text-[var(--sidebar-ink)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex min-w-0 items-center gap-3">
                <Brand />
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <NavPanel
              {...props}
              pathname={pathname}
              searchParams={searchParams}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function AppSidebar(props: Props) {
  return (
    <Suspense
      fallback={
        <>
          <aside
            className={`hidden shrink-0 bg-[var(--sidebar)] lg:block ${
              props.initialCollapsed ? "w-[4.5rem]" : "w-64"
            }`}
            aria-hidden
          />
          <div className="h-14 bg-[var(--sidebar)] lg:hidden" aria-hidden />
        </>
      }
    >
      <SidebarInner {...props} />
    </Suspense>
  );
}
