import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { SettingsForm, type SettingsInitial } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("settings:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: access.ctx.restaurantId },
    select: {
      name: true,
      slug: true,
      fontHeading: true,
      fontBody: true,
      primaryColor: true,
      accentColor: true,
      estYear: true,
      taglineAl: true,
      taglineEn: true,
      subtitleAl: true,
      subtitleEn: true,
      phone: true,
      whatsapp: true,
      address: true,
      city: true,
      cuisine: true,
      latitude: true,
      longitude: true,
      aboutAl: true,
      aboutEn: true,
      isPublished: true,
    },
  });

  if (!restaurant) {
    return <div className="text-muted">Restoranti nuk u gjet.</div>;
  }

  const initial: SettingsInitial = restaurant;
  return <SettingsForm initial={initial} />;
}
