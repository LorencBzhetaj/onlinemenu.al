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

export const INVALID_SCHEDULE = Symbol("invalid-schedule");

/**
 * Zgjidh një scheduleId të dërguar nga klienti: null (pa orar), id i vlefshëm i tenant-it,
 * ose INVALID_SCHEDULE kur id-ja nuk i përket restorantit (duhet refuzuar nga route-i).
 */
export async function resolveScheduleId(
  raw: unknown,
  restaurantId: string
): Promise<string | null | typeof INVALID_SCHEDULE> {
  if (raw === undefined || raw === null || raw === "") return null;
  const id = String(raw);
  const s = await prisma.menuSchedule.findFirst({ where: { id, restaurantId }, select: { id: true } });
  return s ? s.id : INVALID_SCHEDULE;
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
