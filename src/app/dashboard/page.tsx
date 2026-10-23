import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";

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
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl">Përmbledhje</h1>
        <p className="text-alpine-cream/60 mt-1">
          {restaurant ? restaurant.name : "Restoranti yt"}
        </p>
      </div>

      {restaurant ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Statusi i menusë"
              value={restaurant.isPublished ? "E publikuar" : "E fshehur"}
            />
            <StatCard
              label="Kategori"
              value={String(restaurant._count.categories)}
            />
            <StatCard
              label="Abonimi"
              value={restaurant.subscription?.status ?? "—"}
            />
          </div>

          <div className="rounded-lg border border-alpine-cream/10 bg-midnight-soft p-5">
            <h2 className="font-heading text-lg mb-2">Faqja jote publike</h2>
            <p className="text-alpine-cream/70 text-sm mb-3">
              URL-ja që skanohet nga QR (nuk ndryshon kurrë):
            </p>
            <Link
              href={`/m/${restaurant.slug}`}
              className="text-alpine-gold hover:underline break-all"
            >
              /m/{restaurant.slug}
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-alpine-cream/10 bg-midnight-soft p-5 text-alpine-cream/70">
          Nuk u gjet asnjë restorant i lidhur me këtë llogari.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-alpine-cream/10 bg-midnight-soft p-5">
      <div className="text-xs uppercase tracking-wide text-alpine-cream/50">
        {label}
      </div>
      <div className="font-heading text-2xl mt-1">{value}</div>
    </div>
  );
}
