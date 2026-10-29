import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { parseSchedule } from "./shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardRestaurant(req, "menu:read");
  if ("error" in g) return g.error;
  const schedules = await prisma.menuSchedule.findMany({
    where: { restaurantId: g.ctx.restaurantId },
    orderBy: { label: "asc" },
  });
  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }

  const parsed = parseSchedule(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const schedule = await prisma.menuSchedule.create({ data: { restaurantId, ...parsed.data } });
  return NextResponse.json(schedule, { status: 201 });
}
