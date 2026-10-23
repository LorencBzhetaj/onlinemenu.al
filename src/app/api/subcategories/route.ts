import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categoryBelongsTo } from "@/lib/api-auth";
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
