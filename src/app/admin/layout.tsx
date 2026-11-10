import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { PlatformBrand } from "@/components/platform-brand";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="border-b border-line p-4 lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5 lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 lg:block">
          <PlatformBrand area="Admin" href="/admin/restaurants" />
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0">
          <Link
            href="/admin/restaurants"
            className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-surface transition"
          >
            Restorantet
          </Link>
          <Link
            href="/admin/audit"
            className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-surface transition"
          >
            Audit
          </Link>
          <Link
            href="/dashboard"
            className="whitespace-nowrap rounded-md px-3 py-2 text-muted hover:bg-surface transition lg:hidden"
          >
            ← Dashboard
          </Link>
        </nav>

        <div className="mt-auto hidden lg:block pt-6 border-t border-line space-y-2">
          <Link
            href="/dashboard"
            className="block text-sm text-muted hover:text-primary"
          >
            ← Dashboard
          </Link>
          <div className="text-xs text-muted truncate">
            {session.user.email}
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
    </div>
  );
}
