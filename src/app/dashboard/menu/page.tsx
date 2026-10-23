import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { MenuManager } from "./menu-manager";
import type { CategoryDTO } from "@/lib/menu-types";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("menu:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;
  const { restaurantId } = access.ctx;

  // KRITIKE: skopim te restaurantId i validuar me membership. Dashboard-i shfaq edhe
  // artikujt e fshehur (pa filtër isVisible).
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      subcategories: {
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const tree: CategoryDTO[] = categories.map((c) => ({
    id: c.id,
    nameAl: c.nameAl,
    nameEn: c.nameEn,
    icon: c.icon,
    sortOrder: c.sortOrder,
    items: c.items.map(toItem),
    subcategories: c.subcategories.map((s) => ({
      id: s.id,
      nameAl: s.nameAl,
      nameEn: s.nameEn,
      sortOrder: s.sortOrder,
      items: s.items.map(toItem),
    })),
  }));

  return <MenuManager initialTree={tree} />;
}

function toItem(i: {
  id: string;
  nameAl: string;
  nameEn: string;
  descAl: string | null;
  descEn: string | null;
  price: number;
  imageUrl: string | null;
  isChefPick: boolean;
  isDailyMenu: boolean;
  isVisible: boolean;
  sortOrder: number;
}) {
  return {
    id: i.id,
    nameAl: i.nameAl,
    nameEn: i.nameEn,
    descAl: i.descAl,
    descEn: i.descEn,
    price: i.price,
    imageUrl: i.imageUrl,
    isChefPick: i.isChefPick,
    isDailyMenu: i.isDailyMenu,
    isVisible: i.isVisible,
    sortOrder: i.sortOrder,
  };
}
