"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

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
    | "activity"
    | "queue"
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
    path === "/app/properties" &&
    !params.has("status") &&
    searchParams.get("status")
  ) {
    return false;
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
};

function SidebarInner({ items, displayName, role, signOutAction }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-ink)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
          C7
        </span>
        <Link
          href="/app"
          className="font-display text-lg font-semibold tracking-tight text-white"
        >
          Central7 Pulse
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = isActive(pathname, searchParams, item);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {displayName}
            </p>
            <p className="text-xs text-white/55">Logged in as: {role}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-deep)]"
          >
            Log Out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function AppSidebar(props: Props) {
  return (
    <Suspense
      fallback={
        <aside className="w-64 shrink-0 bg-[var(--sidebar)]" aria-hidden />
      }
    >
      <SidebarInner {...props} />
    </Suspense>
  );
}
