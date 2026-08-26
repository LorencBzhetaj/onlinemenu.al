import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-midnight text-alpine-cream lg:flex">
      <aside className="border-b border-alpine-cream/10 p-4 lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5 lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 lg:block">
          <div className="font-heading text-lg lg:mb-8">
            Admin<span className="text-alpine-gold">·</span>Panel
          </div>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0">
          <Link
            href="/admin/restaurants"
            className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-midnight-soft transition"
          >
            Restorantet
          </Link>
          <Link
            href="/dashboard"
            className="whitespace-nowrap rounded-md px-3 py-2 text-alpine-cream/60 hover:bg-midnight-soft transition lg:hidden"
          >
            ← Dashboard
          </Link>
        </nav>

        <div className="mt-auto hidden lg:block pt-6 border-t border-alpine-cream/10 space-y-2">
          <Link
            href="/dashboard"
            className="block text-sm text-alpine-cream/60 hover:text-alpine-gold"
          >
            ← Dashboard
          </Link>
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
