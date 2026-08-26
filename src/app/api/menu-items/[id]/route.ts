import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedRestaurantId, itemBelongsTo } from "@/lib/api-auth";
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
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
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

  const item = await prisma.menuItem.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }
  if (!(await itemBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  await prisma.menuItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
