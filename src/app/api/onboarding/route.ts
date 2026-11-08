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
  // "Regjistro biznesin" kërkon email të verifikuar (në server, jo vetëm nga sesioni).
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true, role: true } });
  if (!me?.emailVerified) {
    return NextResponse.json({ error: "Verifikoni email-in para se të regjistroni biznesin." }, { status: 403 });
  }
  if (me.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Llogaria e administratorit s'regjistron biznes." }, { status: 403 });
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
  const { slug, created } = await prisma.$transaction(async (tx) => {
    const r = await createRestaurantForOwner(tx, ownerId, restaurantName);
    // Llogaria e përdoruesit bëhet pronare biznesi vetëm këtu (në të njëjtin transaksion).
    await tx.user.updateMany({ where: { id: ownerId, role: "USER" }, data: { role: "RESTAURANT_OWNER" } });
    return r;
  });

  return NextResponse.json({ ok: true, slug }, { status: created ? 201 : 200 });
}
