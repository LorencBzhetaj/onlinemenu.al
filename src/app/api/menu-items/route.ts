import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categoryBelongsTo, subcategoryBelongsTo } from "@/lib/api-auth";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";

export async function POST(req: Request) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
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
  const isAvailable = body.isAvailable === undefined ? true : Boolean(body.isAvailable);
  const allergenIds = Array.isArray(body.allergenIds) ? body.allergenIds.map(String) : [];

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

  // Alergjenët: pranohen vetëm ata që i përkasin këtij restoranti (izolim tenant).
  const validAllergenIds = await filterOwnedAllergenIds(allergenIds, restaurantId);

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
      isAvailable,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      allergens: { create: validAllergenIds.map((allergenId) => ({ allergenId })) },
    },
  });

  return NextResponse.json(item, { status: 201 });
}

/** Mban vetëm allergenId-të që i përkasin restorantit (shmang lidhje cross-tenant). */
async function filterOwnedAllergenIds(ids: string[], restaurantId: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const owned = await prisma.allergen.findMany({
    where: { id: { in: ids }, restaurantId },
    select: { id: true },
  });
  return owned.map((a) => a.id);
}
