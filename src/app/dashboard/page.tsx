import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, StatCard } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("menu:read", restaurantIdFromSearchParams(searchParams));
  const restaurant = access.ok
    ? await prisma.restaurant.findUnique({
        where: { id: access.ctx.restaurantId },
        include: {
          subscription: true,
          _count: { select: { categories: true, tastingMenus: true } },
        },
      })
    : null;

  return (
    <div>
      <PageHeader title="Përmbledhje" subtitle={restaurant ? restaurant.name : "Restoranti yt"} />

      {restaurant ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Statusi i menusë" value={restaurant.isPublished ? "E publikuar" : "E fshehur"} />
            <StatCard label="Kategori" value={String(restaurant._count.categories)} />
            <StatCard label="Abonimi" value={<StatusBadge status={restaurant.subscription?.status ?? "—"} />} />
          </div>

          <Card className="p-5">
            <h2 className="mb-2 font-display text-lg text-ink">Profili yt publik</h2>
            <p className="mb-3 text-sm text-muted">
              QR-ja hap profilin; menuja, informacioni dhe lidhjet hapen prej tij.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/restaurants/${restaurant.slug}`} target="_blank" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                Shiko profilin
              </Link>
              <Link href={`/restaurants/${restaurant.slug}/menu`} target="_blank" className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:border-primary hover:text-primary">
                Shiko menunë
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <Notice>Nuk u gjet asnjë restorant i lidhur me këtë llogari.</Notice>
      )}
    </div>
  );
}
