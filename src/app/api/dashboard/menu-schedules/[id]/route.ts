import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { parseSchedule } from "../shared";

async function scheduleBelongsTo(id: string, restaurantId: string): Promise<boolean> {
  const s = await prisma.menuSchedule.findFirst({ where: { id, restaurantId }, select: { id: true } });
  return !!s;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await scheduleBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const parsed = parseSchedule(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const schedule = await prisma.menuSchedule.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(schedule);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await scheduleBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  // Category.scheduleId → SetNull automatikisht (FK), kategoritë mbeten pa orar.
  await prisma.menuSchedule.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
