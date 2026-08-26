import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedRestaurantId, categoryBelongsTo } from "@/lib/api-auth";

export async function POST(req: Request) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const categoryId = String(body.categoryId ?? "");
  const nameAl = String(body.nameAl ?? "").trim();
  const nameEn = String(body.nameEn ?? "").trim();

  if (!categoryId || !nameAl || !nameEn) {
    return NextResponse.json(
      { error: "Kategoria prind dhe emrat (AL/EN) janë të detyrueshëm." },
      { status: 400 }
    );
  }

  // Verifikon që kategoria prind i përket këtij restoranti.
  if (!(await categoryBelongsTo(categoryId, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const last = await prisma.subcategory.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const subcategory = await prisma.subcategory.create({
    data: {
      categoryId,
      nameAl,
      nameEn,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(subcategory, { status: 201 });
}
