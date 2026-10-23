import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export const TRIAL_DAYS = 30;

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Siguron (idempotent) që pronari të ketë një Restaurant me Subscription trial.
 * Nëse pronari TASHMË ka restorant → e kthen pa krijuar tjetër (parandalon dublim).
 *
 * Pranon një klient transaksioni (`tx`) që logjika të kompozohet brenda një
 * transaksioni më të madh — p.sh. verifikimi i email-it krijon restorantin
 * ATOMIKISHT bashkë me konsumimin e kredencialit (asnjë dy restorante/trial).
 */
export async function ensureRestaurantWithTrial(
  db: Db,
  ownerId: string,
  restaurantName: string
): Promise<{ slug: string; created: boolean }> {
  const existing = await db.restaurant.findFirst({
    where: { ownerId },
    select: { slug: true },
  });
  if (existing) return { slug: existing.slug, created: false };

  // Slug unik nga emri (i njëjti pattern si te /api/register dhe /api/onboarding).
  const base = slugify(restaurantName) || "restoranti";
  let slug = base;
  let n = 1;
  while (await db.restaurant.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

  const restaurant = await db.restaurant.create({
    data: {
      name: restaurantName,
      slug,
      ownerId,
      subscription: { create: { plan: "monthly", status: "trial", expiresAt } },
    },
    select: { slug: true },
  });

  return { slug: restaurant.slug, created: true };
}
