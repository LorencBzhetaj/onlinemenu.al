import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { RestaurantProvider } from "@/components/restaurant-context";
import { RestaurantSwitcher } from "@/components/restaurant-switcher";
import { DashboardNav } from "@/components/dashboard-nav";
import { listMemberships } from "@/modules/memberships/active-restaurant";
import { PlatformBrand } from "@/components/platform-brand";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const memberships = await listMemberships(session.user.id);

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      {/* Sidebar në desktop; top-bar horizontal në mobile. */}
      <aside className="border-b border-line bg-surface p-4 lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5 lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 lg:block">
          <PlatformBrand area="Paneli" href="/dashboard" />
          {/* Në mobile: dalja në krye-djathtas */}
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <RestaurantSwitcher memberships={memberships} activeId={session.user.restaurantId} />

        <DashboardNav isAdmin={isAdmin} />

        {/* Footer-i i sidebar-it: vetëm desktop */}
        <div className="mt-auto hidden lg:block pt-6 border-t border-line space-y-2">
          {isAdmin && (
            <Link href="/admin" className="block text-sm text-primary hover:underline">
              → Paneli Admin
            </Link>
          )}
          <div className="text-xs text-muted truncate">{session.user.email}</div>
          <LogoutButton />
        </div>
      </aside>

      {/* Restoranti aktiv përcillet te komponentët klient (header x-restaurant-id). */}
      <RestaurantProvider restaurantId={session.user.restaurantId}>
        <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
      </RestaurantProvider>
    </div>
  );
}
