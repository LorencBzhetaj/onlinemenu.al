import { prisma } from "@/lib/prisma";
import { pageAccess } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { QrGenerator } from "./qr-generator";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const access = await pageAccess("qr:read");
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: access.ctx.restaurantId },
    select: { slug: true },
  });

  if (!restaurant) {
    return <div className="text-alpine-cream/70">Restoranti nuk u gjet.</div>;
  }

  return <QrGenerator slug={restaurant.slug} />;
}
