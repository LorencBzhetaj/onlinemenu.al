import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { ensureQrCode } from "@/modules/restaurants/qr";
import { DashboardNotice } from "@/components/dashboard-notice";
import { QrGenerator } from "./qr-generator";

export const dynamic = "force-dynamic";

export default async function QrPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("qr:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: access.ctx.restaurantId },
    select: { slug: true },
  });

  if (!restaurant) {
    return <div className="text-muted">Restoranti nuk u gjet.</div>;
  }

  // Kodi QR opak (krijohet nëse mungon, p.sh. restorante të vjetra para Fazës 3).
  const code = await ensureQrCode(prisma, access.ctx.restaurantId);

  return <QrGenerator code={code} slug={restaurant.slug} />;
}
