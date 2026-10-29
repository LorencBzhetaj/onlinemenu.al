import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { LinksForm } from "./links-form";
import { LINK_TYPES, type LinkType } from "@/modules/restaurants/external-links";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("links:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const rows = await prisma.restaurantExternalLink.findMany({
    where: { restaurantId: access.ctx.restaurantId },
    select: { type: true, url: true, enabled: true },
  });

  const byType = new Map(rows.map((r) => [r.type, r]));
  const initial = LINK_TYPES.map((type) => {
    const r = byType.get(type);
    return { type: type as LinkType, url: r?.url ?? "", enabled: r?.enabled ?? true, exists: !!r };
  });

  return <LinksForm initial={initial} />;
}
