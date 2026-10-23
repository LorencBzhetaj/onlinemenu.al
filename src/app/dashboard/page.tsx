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
            <h2 className="mb-2 font-display text-lg text-ink">Faqja jote publike</h2>
            <p className="mb-3 text-sm text-muted">URL-ja që skanohet nga QR (nuk ndryshon kurrë):</p>
            <Link href={`/m/${restaurant.slug}`} className="break-all font-medium text-primary hover:underline">
              /m/{restaurant.slug}
            </Link>
          </Card>
        </div>
      ) : (
        <Notice>Nuk u gjet asnjë restorant i lidhur me këtë llogari.</Notice>
      )}
    </div>
  );
}
