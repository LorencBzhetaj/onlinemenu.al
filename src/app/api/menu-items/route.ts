import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthedRestaurantId,
  categoryBelongsTo,
  subcategoryBelongsTo,
} from "@/lib/api-auth";

export async function POST(req: Request) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const nameAl = String(body.nameAl ?? "").trim();
  const nameEn = String(body.nameEn ?? "").trim();
  const descAl = body.descAl ? String(body.descAl).trim() : null;
  const descEn = body.descEn ? String(body.descEn).trim() : null;
  const price = Math.trunc(Number(body.price));
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const isChefPick = Boolean(body.isChefPick);
  const isDailyMenu = Boolean(body.isDailyMenu);
  const isVisible = body.isVisible === undefined ? true : Boolean(body.isVisible);

  const categoryId = body.categoryId ? String(body.categoryId) : null;
  const subcategoryId = body.subcategoryId ? String(body.subcategoryId) : null;

  // Validim
  if (!nameAl || !nameEn) {
    return NextResponse.json(
      { error: "Emri (AL) dhe emri (EN) janë të detyrueshëm." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "Çmimi duhet të jetë numër i plotë më i madh se 0." },
      { status: 400 }
    );
  }
  // Saktësisht një prind: ose kategori, ose nën-kategori (jo të dyja, jo asnjë).
  if ((categoryId && subcategoryId) || (!categoryId && !subcategoryId)) {
    return NextResponse.json(
      { error: "Artikulli duhet të lidhet me një kategori OSE një nën-kategori." },
      { status: 400 }
    );
  }

  // Verifikon pronësinë e prindit.
  if (categoryId && !(await categoryBelongsTo(categoryId, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }
  if (subcategoryId && !(await subcategoryBelongsTo(subcategoryId, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const last = await prisma.menuItem.findFirst({
    where: categoryId ? { categoryId } : { subcategoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const item = await prisma.menuItem.create({
    data: {
      categoryId,
      subcategoryId,
      nameAl,
      nameEn,
      descAl,
      descEn,
      price,
      imageUrl,
      isChefPick,
      isDailyMenu,
      isVisible,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
