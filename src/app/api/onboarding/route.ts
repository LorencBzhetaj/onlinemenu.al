import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureRestaurantWithTrial } from "@/lib/restaurant";
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

  // Helper-i i njëjtë që përdor edhe verifikimi i email-it (idempotent, pa dublim).
  const { slug, created } = await ensureRestaurantWithTrial(prisma, session.user.id, restaurantName);

  return NextResponse.json({ ok: true, slug }, { status: created ? 201 : 200 });
}
