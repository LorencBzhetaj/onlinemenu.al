import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const NAV = [
  { href: "/dashboard", label: "Përmbledhje" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/tasting-menus", label: "Menu Degustuese" },
  { href: "/dashboard/branding", label: "Personalizim" },
  { href: "/dashboard/qr", label: "QR Kod" },
  { href: "/dashboard/analytics", label: "Analitika" },
  { href: "/dashboard/settings", label: "Cilësime" },
  { href: "/dashboard/billing", label: "Abonimi" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-midnight text-alpine-cream lg:flex">
      {/* Sidebar në desktop; top-bar horizontal në mobile. */}
      <aside className="border-b border-alpine-cream/10 p-4 lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5 lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 lg:block">
          <div className="font-heading text-lg lg:mb-8">
            Menu<span className="text-alpine-gold">Digjitale</span>
          </div>
          {/* Në mobile: dalja në krye-djathtas */}
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-midnight-soft transition"
            >
              {item.label}
            </Link>
          ))}
          {/* Lidhja Admin brenda nav-it në mobile (footer-i fshihet) */}
          {isAdmin && (
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-md px-3 py-2 text-alpine-gold hover:bg-midnight-soft transition lg:hidden"
            >
              → Admin
            </Link>
          )}
        </nav>

        {/* Footer-i i sidebar-it: vetëm desktop */}
        <div className="mt-auto hidden lg:block pt-6 border-t border-alpine-cream/10 space-y-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="block text-sm text-alpine-gold hover:underline"
            >
              → Paneli Admin
            </Link>
          )}
          <div className="text-xs text-alpine-cream/50 truncate">
            {session.user.email}
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
    </div>
  );
}
