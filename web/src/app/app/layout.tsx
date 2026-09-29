import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessSocialQueue, requireProfile } from "@/lib/auth";
import { signOut } from "@/app/app/actions";
import { PropertyModalProvider } from "@/app/app/properties/property-modal";
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

  const sidebarCollapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const isAdmin = profile.role === "Admin";
  const socialOk = isAdmin || (await canAccessSocialQueue(profile));

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
    ...(isAdmin
      ? ([
          {
            href: "/app/user-management",
            label: "Users",
            icon: "users",
            match: "exact",
          },
          { href: "/app/activity", label: "Activity Log", icon: "activity" },
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
    <PropertyModalProvider>
      <NavigationPendingProvider>
        <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
          <AppSidebar
            items={nav}
            displayName={profile.display_name}
            role={profile.role}
            signOutAction={signOut}
            initialCollapsed={sidebarCollapsed}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <PendingMain className="flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:overflow-auto lg:px-8">
              {children}
            </PendingMain>
          </div>
        </div>
      </NavigationPendingProvider>
      {modal}
    </PropertyModalProvider>
  );
}
