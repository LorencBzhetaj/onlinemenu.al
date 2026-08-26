import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const TRIAL_DAYS = 30;

/**
 * Krijon Restaurant + Subscription trial për përdoruesin e kyçur (p.sh. që u kyç
 * me Google dhe ende s'ka restorant). Nuk krijon User (ai ekziston tashmë).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }

  // Parandalon dublim: nëse ky user tashmë ka restorant, mos krijo tjetër.
  const existing = await prisma.restaurant.findFirst({
    where: { ownerId: session.user.id },
    select: { slug: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, slug: existing.slug });
  }

  const body = await req.json().catch(() => ({}));
  const restaurantName = String(body.restaurantName ?? "").trim();
  if (!restaurantName) {
    return NextResponse.json(
      { error: "Emri i restorantit është i detyrueshëm." },
      { status: 400 }
    );
  }

  // Slug unik (i njëjti pattern si te /api/register).
  const base = slugify(restaurantName) || "restoranti";
  let slug = base;
  let n = 1;
  while (await prisma.restaurant.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: restaurantName,
      slug,
      ownerId: session.user.id,
      subscription: {
        create: { plan: "monthly", status: "trial", expiresAt },
      },
    },
    select: { slug: true },
  });

  return NextResponse.json({ ok: true, slug: restaurant.slug }, { status: 201 });
}
