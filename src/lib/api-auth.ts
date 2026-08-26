import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Konteksti i autorizuar për mutacione në menu.
 * Kthen restaurantId të pronarit të loguar, ose null nëse s'ka autorizim.
 *
 * KRITIKE për izolimin multi-tenant: çdo rrugë API duhet ta thërrasë këtë dhe
 * të filtrojë/verifikojë çdo objekt sipas këtij restaurantId.
 */
export async function getAuthedRestaurantId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user.restaurantId ?? null;
}

/** Verifikon që një kategori i përket restorantit të dhënë. */
export async function categoryBelongsTo(
  categoryId: string,
  restaurantId: string
): Promise<boolean> {
  const c = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true },
  });
  return !!c;
}

/** Verifikon që një nën-kategori i përket restorantit (nëpërmjet kategorisë prind). */
export async function subcategoryBelongsTo(
  subcategoryId: string,
  restaurantId: string
): Promise<boolean> {
  const s = await prisma.subcategory.findFirst({
    where: { id: subcategoryId, category: { restaurantId } },
    select: { id: true },
  });
  return !!s;
}

/** Verifikon që një artikull i përket restorantit (nëpërmjet kategori/nën-kategori). */
export async function itemBelongsTo(
  itemId: string,
  restaurantId: string
): Promise<boolean> {
  const i = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      OR: [
        { category: { restaurantId } },
        { subcategory: { category: { restaurantId } } },
      ],
    },
    select: { id: true },
  });
  return !!i;
}
