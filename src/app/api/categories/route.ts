import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveScheduleId, INVALID_SCHEDULE } from "@/lib/api-auth";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";

export async function POST(req: Request) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nameAl = String(body.nameAl ?? "").trim();
  const nameEn = String(body.nameEn ?? "").trim();
  const icon = body.icon ? String(body.icon).trim() : null;

  if (!nameAl || !nameEn) {
    return NextResponse.json(
      { error: "Emri (AL) dhe emri (EN) janë të detyrueshëm." },
      { status: 400 }
    );
  }

  // Orari i menusë (opsional): vetëm një orar i këtij restoranti, ndryshe refuzohet.
  const scheduleId = await resolveScheduleId(body.scheduleId, restaurantId);
  if (scheduleId === INVALID_SCHEDULE) {
    return NextResponse.json({ error: "Orar i pavlefshëm." }, { status: 400 });
  }

  // sortOrder = fundi i listës aktuale.
  const last = await prisma.category.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const category = await prisma.category.create({
    data: {
      restaurantId,
      nameAl,
      nameEn,
      icon,
      scheduleId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
