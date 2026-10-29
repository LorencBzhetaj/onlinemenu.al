import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { parseTastingBody } from "../shared";

async function tastingBelongsTo(id: string, restaurantId: string): Promise<boolean> {
  const t = await prisma.tastingMenu.findFirst({ where: { id, restaurantId }, select: { id: true } });
  return !!t;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await tastingBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseTastingBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const menu = await prisma.tastingMenu.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(menu);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await tastingBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  await prisma.tastingMenu.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
