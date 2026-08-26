import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandingForm, type BrandingInitial } from "./branding-form";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
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
    select: {
      name: true,
      primaryColor: true,
      accentColor: true,
      fontHeading: true,
      fontBody: true,
      logoUrl: true,
      menuPhotoStyle: true,
    },
  });

  if (!restaurant) {
    return <div className="text-alpine-cream/70">Restoranti nuk u gjet.</div>;
  }

  const initial: BrandingInitial = restaurant;
  return <BrandingForm initial={initial} />;
}
