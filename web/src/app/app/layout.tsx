import { redirect } from "next/navigation";
import { canAccessSocialQueue, requireProfile } from "@/lib/auth";
import { signOut } from "@/app/app/actions";
import { PropertyModalProvider } from "@/app/app/properties/property-modal";
import { AppSidebar, type SidebarNavItem } from "./app-sidebar";

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
  const socialOk = isAdmin || (await canAccessSocialQueue(profile));

  const nav: SidebarNavItem[] = [
    { href: "/app", label: "My Dashboard", icon: "home", match: "exact" },
    { href: "/app/properties", label: "Properties", icon: "folder" },
    {
      href: "/app/properties?status=Active",
      label: "Active Properties",
      icon: "check",
      match: "exact",
    },
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
    { href: "/app/account", label: "Account", icon: "account" },
  ];

  return (
    <PropertyModalProvider>
      <div className="flex min-h-screen bg-[var(--bg)]">
        <AppSidebar
          items={nav}
          displayName={profile.display_name}
          role={profile.role}
          signOutAction={signOut}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-auto px-6 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
      {modal}
    </PropertyModalProvider>
  );
}
