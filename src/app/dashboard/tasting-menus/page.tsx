import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { TastingManager, type TastingDTO, type CourseDTO } from "./tasting-manager";

export const dynamic = "force-dynamic";

function parseCourses(value: unknown): CourseDTO[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    return {
      titleAl: String(o.titleAl ?? ""),
      titleEn: String(o.titleEn ?? ""),
      descAl: String(o.descAl ?? ""),
      descEn: String(o.descEn ?? ""),
    };
  });
}

export default async function TastingMenusPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("menu:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const menus = await prisma.tastingMenu.findMany({
    where: { restaurantId: access.ctx.restaurantId },
    orderBy: { name: "asc" },
  });

  const dtos: TastingDTO[] = menus.map((m) => ({
    id: m.id,
    name: m.name,
    price: m.price,
    guestCount: m.guestCount,
    courses: parseCourses(m.courses),
  }));

  return <TastingManager initial={dtos} />;
}
