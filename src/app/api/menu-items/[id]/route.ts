import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemBelongsTo } from "@/lib/api-auth";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import type { Prisma } from "@prisma/client";

/**
 * PUT — përditësim i pjesshëm. Përdoret edhe për editim të plotë të formularit,
 * edhe për toggle të shpejtë të isVisible (body = { isVisible: bool }).
 * Prindi (categoryId/subcategoryId) nuk ndryshohet këtu.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await itemBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Prisma.MenuItemUpdateInput = {};

  if (body.nameAl !== undefined) {
    const v = String(body.nameAl).trim();
    if (!v) return NextResponse.json({ error: "Emri (AL) s'mund të jetë bosh." }, { status: 400 });
    data.nameAl = v;
  }
  if (body.nameEn !== undefined) {
    const v = String(body.nameEn).trim();
    if (!v) return NextResponse.json({ error: "Emri (EN) s'mund të jetë bosh." }, { status: 400 });
    data.nameEn = v;
  }
  if (body.descAl !== undefined) data.descAl = body.descAl ? String(body.descAl).trim() : null;
  if (body.descEn !== undefined) data.descEn = body.descEn ? String(body.descEn).trim() : null;
  if (body.price !== undefined) {
    const price = Math.trunc(Number(body.price));
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: "Çmimi duhet të jetë numër i plotë më i madh se 0." },
        { status: 400 }
      );
    }
    data.price = price;
  }
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  if (body.isChefPick !== undefined) data.isChefPick = Boolean(body.isChefPick);
  if (body.isDailyMenu !== undefined) data.isDailyMenu = Boolean(body.isDailyMenu);
  if (body.isVisible !== undefined) data.isVisible = Boolean(body.isVisible);
  if (body.isAvailable !== undefined) data.isAvailable = Boolean(body.isAvailable);

  // Alergjenët (opsional): kur jepet array, zëvendëson plotësisht; vetëm ata të tenant-it.
  const replaceAllergens = Array.isArray(body.allergenIds);
  const allergenIds: string[] = replaceAllergens ? body.allergenIds.map(String) : [];

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.menuItem.update({ where: { id: params.id }, data });
    if (replaceAllergens) {
      const owned = await tx.allergen.findMany({
        where: { id: { in: allergenIds }, restaurantId },
        select: { id: true },
      });
      await tx.menuItemAllergen.deleteMany({ where: { menuItemId: params.id } });
      if (owned.length > 0) {
        await tx.menuItemAllergen.createMany({
          data: owned.map((a) => ({ menuItemId: params.id, allergenId: a.id })),
        });
      }
    }
    return updated;
  });

  return NextResponse.json(item);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await itemBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  await prisma.menuItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
