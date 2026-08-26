import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedRestaurantId, subcategoryBelongsTo } from "@/lib/api-auth";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }
  if (!(await subcategoryBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nameAl = String(body.nameAl ?? "").trim();
  const nameEn = String(body.nameEn ?? "").trim();

  if (!nameAl || !nameEn) {
    return NextResponse.json(
      { error: "Emri (AL) dhe emri (EN) janë të detyrueshëm." },
      { status: 400 }
    );
  }

  const subcategory = await prisma.subcategory.update({
    where: { id: params.id },
    data: { nameAl, nameEn },
  });

  return NextResponse.json(subcategory);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }
  if (!(await subcategoryBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  await prisma.subcategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
