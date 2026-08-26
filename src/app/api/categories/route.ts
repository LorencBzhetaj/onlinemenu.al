import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedRestaurantId } from "@/lib/api-auth";

export async function POST(req: Request) {
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
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

  // sortOrder = fundi i listës aktuale.
  const last = await prisma.category.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const category = await prisma.category.create({
    data: {
      restaurantId,
      nameAl,
      nameEn,
      icon,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
