import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { prisma } from "@/lib/prisma";

/**
 * Krijon Restaurant + Subscription trial për përdoruesin e kyçur (p.sh. që u kyç
 * me Google dhe ende s'ka restorant). Nuk krijon User (ai ekziston tashmë).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const restaurantName = String(body.restaurantName ?? "").trim();
  if (!restaurantName) {
    return NextResponse.json(
      { error: "Emri i restorantit është i detyrueshëm." },
      { status: 400 }
    );
  }

  // Krijim atomik (brenda një transaksioni; createRestaurantForOwner kërkon tx për lock-un).
  const ownerId = session.user.id;
  const { slug, created } = await prisma.$transaction((tx) =>
    createRestaurantForOwner(tx, ownerId, restaurantName)
  );

  return NextResponse.json({ ok: true, slug }, { status: created ? 201 : 200 });
}
