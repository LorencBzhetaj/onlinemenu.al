import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { MenuManager } from "./menu-manager";
import type { CategoryDTO, ItemDTO, AllergenDTO, ScheduleDTO } from "@/lib/menu-types";

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
  const [categories, allergens, schedules] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      include: {
        items: { orderBy: { sortOrder: "asc" }, include: { allergens: { select: { allergenId: true } } } },
        subcategories: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" }, include: { allergens: { select: { allergenId: true } } } } },
        },
      },
    }),
    prisma.allergen.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } }),
    prisma.menuSchedule.findMany({ where: { restaurantId }, orderBy: { label: "asc" } }),
  ]);

  const tree: CategoryDTO[] = categories.map((c) => ({
    id: c.id,
    nameAl: c.nameAl,
    nameEn: c.nameEn,
    icon: c.icon,
    scheduleId: c.scheduleId,
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

  const allergenDtos: AllergenDTO[] = allergens.map((a) => ({ id: a.id, nameAl: a.nameAl, nameEn: a.nameEn, icon: a.icon }));
  const scheduleDtos: ScheduleDTO[] = schedules.map((s) => ({
    id: s.id,
    label: s.label,
    days: s.days,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
  }));

  return <MenuManager initialTree={tree} allergens={allergenDtos} schedules={scheduleDtos} />;
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
  isAvailable: boolean;
  sortOrder: number;
  allergens: { allergenId: string }[];
}): ItemDTO {
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
    isAvailable: i.isAvailable,
    allergenIds: i.allergens.map((a) => a.allergenId),
    sortOrder: i.sortOrder,
  };
}
