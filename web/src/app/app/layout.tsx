import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessSocialQueue, isRealAdmin, requireProfile } from "@/lib/auth";
import { signOut } from "@/app/app/actions";
import { setViewMode } from "@/app/app/view-mode-actions";
import { PropertyModalProvider } from "@/app/app/properties/property-modal";
import { CitiesProvider } from "@/components/cities-context";
import { loadCities } from "@/lib/cities-server";
import { AppSidebar, type SidebarNavItem } from "./app-sidebar";
import { NavigationPendingProvider, PendingMain } from "./navigation-pending";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  let profile;
  try {
    profile = await requireProfile();
  } catch {
    redirect("/auth/continue");
  }

  const isAdmin = profile.role === "Admin";
  const [cookieStore, socialAccess, cities] = await Promise.all([
    cookies(),
    isAdmin ? true : canAccessSocialQueue(profile),
    loadCities(),
  ]);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const socialOk = isAdmin || socialAccess;

  const propertyNav: SidebarNavItem[] = isAdmin
    ? [{ href: "/app/properties", label: "Properties", icon: "folder" }]
    : [
        { href: "/app/properties", label: "Search Property", icon: "search" },
        { href: "/app/add-property", label: "Add Property", icon: "plus" },
        { href: "/app/my-properties", label: "My Properties", icon: "folder" },
      ];

  const nav: SidebarNavItem[] = [
    { href: "/app", label: "My Dashboard", icon: "home", match: "exact" },
    ...propertyNav,
    { href: "/app/complexes", label: "Apartment Complexes", icon: "building" },
    ...(isAdmin
      ? ([
          { href: "/app/cities", label: "Cities", icon: "map" },
          {
            href: "/app/user-management",
            label: "Users",
            icon: "users",
            match: "exact",
          },
          { href: "/app/activity", label: "Activity Log", icon: "activity" },
          { href: "/app/finance", label: "Finance", icon: "finance" },
        ] as SidebarNavItem[])
      : []),
    ...(socialOk
      ? ([
          {
            href: "/app/social-queue",
            label: "Social Media Queue",
            icon: "queue",
          },
        ] as SidebarNavItem[])
      : []),
    { href: "/app/account", label: "Profile", icon: "account" },
  ];

  return (
    <CitiesProvider cities={cities}>
      <PropertyModalProvider>
        <NavigationPendingProvider>
          <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
            <AppSidebar
              items={nav}
              displayName={profile.display_name}
              role={profile.viewingAsUser ? "Admin" : profile.role}
              signOutAction={signOut}
              initialCollapsed={sidebarCollapsed}
              viewSwitch={
                isRealAdmin(profile)
                  ? { mode: profile.viewingAsUser ? "user" : "admin", action: setViewMode }
                  : undefined
              }
            />
            <div className="flex min-w-0 flex-1 flex-col">
              {profile.viewingAsUser ? (
                <form
                  action={setViewMode}
                  className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[var(--brand)]/20 bg-[var(--brand)]/[0.06] px-4 py-2 text-center text-sm text-[var(--brand-deep)]"
                >
                  <input type="hidden" name="mode" value="admin" />
                  <span>
                    You&apos;re viewing the app as a <strong>User</strong>. Admin pages and actions are hidden.
                  </span>
                  <button
                    type="submit"
                    className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-deep)]"
                  >
                    Back to admin view
                  </button>
                </form>
              ) : null}
              <PendingMain className="flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:overflow-auto lg:px-8">
                {children}
              </PendingMain>
            </div>
          </div>
        </NavigationPendingProvider>
        {modal}
      </PropertyModalProvider>
    </CitiesProvider>
  );
}
