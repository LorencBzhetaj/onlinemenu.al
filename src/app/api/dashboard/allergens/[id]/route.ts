import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { parseAllergen } from "../shared";

async function allergenBelongsTo(id: string, restaurantId: string): Promise<boolean> {
  const a = await prisma.allergen.findFirst({ where: { id, restaurantId }, select: { id: true } });
  return !!a;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await allergenBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const parsed = parseAllergen(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const allergen = await prisma.allergen.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(allergen);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await allergenBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  // Cascade: heq edhe lidhjet MenuItemAllergen (onDelete: Cascade te schema).
  await prisma.allergen.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
