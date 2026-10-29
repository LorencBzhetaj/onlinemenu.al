import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { parseTastingBody } from "./shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardRestaurant(req, "menu:read");
  if ("error" in g) return g.error;
  const menus = await prisma.tastingMenu.findMany({
    where: { restaurantId: g.ctx.restaurantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ menus });
}

export async function POST(req: Request) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseTastingBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const menu = await prisma.tastingMenu.create({
    data: { restaurantId, ...parsed.data },
  });
  return NextResponse.json(menu, { status: 201 });
}
