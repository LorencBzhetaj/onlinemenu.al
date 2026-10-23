import { prisma } from "@/lib/prisma";

// Verifikim pronësie i objekteve brenda një tenant-i. Autorizimi i tenant-it/rolit
// bëhet nga @/modules/memberships/access (requireRestaurantAccess/guardRestaurant);
// këto helper-a sigurojnë që objekti i prekur i përket restaurantId-së së autorizuar.

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
