import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { BrandingForm, type BrandingInitial } from "./branding-form";

export const dynamic = "force-dynamic";

export default async function BrandingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("branding:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: access.ctx.restaurantId },
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
