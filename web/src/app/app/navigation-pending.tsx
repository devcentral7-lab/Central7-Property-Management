"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccountSkeleton,
  ActivitySkeleton,
  DashboardSkeleton,
  GenericPageSkeleton,
  PropertiesSkeleton,
  SocialQueueSkeleton,
  UserManagementSkeleton,
} from "@/components/skeletons";

const PendingContext = createContext<URL | null>(null);

/** Target URL of an in-flight in-app navigation, or null when idle. */
export function usePendingNavigation() {
  return useContext(PendingContext);
}

const SAFETY_TIMEOUT_MS = 15000;

function RouteWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange();
  }, [key, onChange]);

  return null;
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<URL | null>(null);
  const [clear] = useState(() => () => setPending(null));

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.dataset.navSkip !== undefined) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/app")) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      setPending(url);
    }

    window.addEventListener("click", onClick);
    window.addEventListener("popstate", clear);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", clear);
    };
  }, [clear]);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(clear, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pending, clear]);

  return (
    <PendingContext.Provider value={pending}>
      <Suspense fallback={null}>
        <RouteWatcher onChange={clear} />
      </Suspense>
      {children}
    </PendingContext.Provider>
  );
}

function skeletonFor(url: URL) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/app") return <DashboardSkeleton />;
  if (path.startsWith("/app/add-property")) return <PropertiesSkeleton tab="add" tabs={false} />;
  if (path.startsWith("/app/my-properties")) return <PropertiesSkeleton tab="mine" tabs={false} />;
  if (path === "/app/properties" || path.startsWith("/app/properties/")) {
    const tab = (url.searchParams.get("tab") ?? "").toLowerCase();
    return (
      <PropertiesSkeleton
        tab={tab === "add" || tab === "options" ? "add" : tab === "mine" ? "mine" : "search"}
      />
    );
  }
  if (path.startsWith("/app/activity")) return <ActivitySkeleton />;
  if (path.startsWith("/app/social-queue")) return <SocialQueueSkeleton />;
  if (
    path.startsWith("/app/user-management") ||
    path.startsWith("/app/users") ||
    path.startsWith("/app/agents")
  ) {
    return <UserManagementSkeleton />;
  }
  if (path.startsWith("/app/account")) return <AccountSkeleton />;
  return <GenericPageSkeleton />;
}

/** Swaps page content for a matching skeleton the instant an in-app link is clicked. */
export function PendingMain({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const pending = usePendingNavigation();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!pending) return;
    ref.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pending]);

  return (
    <main ref={ref} className={className}>
      {pending ? skeletonFor(pending) : null}
      <div className={pending ? "hidden" : undefined}>{children}</div>
    </main>
  );
}
