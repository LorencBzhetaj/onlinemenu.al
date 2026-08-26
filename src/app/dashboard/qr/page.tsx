import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QrGenerator } from "./qr-generator";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const session = await getServerSession(authOptions);
  const restaurantId = session?.user.restaurantId ?? null;

  if (!restaurantId) {
    return (
      <div className="rounded-lg border border-alpine-cream/10 bg-midnight-soft p-6 text-alpine-cream/70">
        Nuk u gjet asnjë restorant i lidhur me këtë llogari.
      </div>
    );
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });

  if (!restaurant) {
    return <div className="text-alpine-cream/70">Restoranti nuk u gjet.</div>;
  }

  return <QrGenerator slug={restaurant.slug} />;
}
