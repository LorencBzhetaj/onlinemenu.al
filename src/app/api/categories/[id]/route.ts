import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedRestaurantId, categoryBelongsTo } from "@/lib/api-auth";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }
  if (!(await categoryBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
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

  const category = await prisma.category.update({
    where: { id: params.id },
    data: { nameAl, nameEn, icon },
  });

  return NextResponse.json(category);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }
  if (!(await categoryBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  // Cascade: fshin edhe nën-kategoritë dhe artikujt (onDelete: Cascade te schema).
  await prisma.category.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
