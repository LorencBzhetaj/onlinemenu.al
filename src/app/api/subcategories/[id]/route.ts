import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subcategoryBelongsTo } from "@/lib/api-auth";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";

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
  req: Request,
  { params }: { params: { id: string } }
) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }
  if (!(await subcategoryBelongsTo(params.id, restaurantId))) {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  await prisma.subcategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
