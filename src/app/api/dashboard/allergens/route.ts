import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { parseAllergen } from "./shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardRestaurant(req, "menu:read");
  if ("error" in g) return g.error;
  const allergens = await prisma.allergen.findMany({
    where: { restaurantId: g.ctx.restaurantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ allergens });
}

export async function POST(req: Request) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }

  const parsed = parseAllergen(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const last = await prisma.allergen.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const allergen = await prisma.allergen.create({
    data: { restaurantId, ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json(allergen, { status: 201 });
}
