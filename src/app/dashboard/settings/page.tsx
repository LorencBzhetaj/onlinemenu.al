import { prisma } from "@/lib/prisma";
import { pageAccess } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { SettingsForm, type SettingsInitial } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await pageAccess("settings:read");
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
      isPublished: true,
    },
  });

  if (!restaurant) {
    return <div className="text-alpine-cream/70">Restoranti nuk u gjet.</div>;
  }

  const initial: SettingsInitial = restaurant;
  return <SettingsForm initial={initial} />;
}
