import { prisma } from "@/lib/prisma";
import { isRole, Role } from "./permissions";
import { AccessError } from "./access";

/**
 * Vendos restorantin aktiv të përdoruesit — VETËM nëse ka membership aktiv për të.
 * Është default navigimi (JO autoritet lejesh; çdo kërkesë private rikontrollohet).
 */
export async function selectActiveRestaurant(userId: string, restaurantId: string): Promise<void> {
  const membership = await prisma.restaurantMembership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { status: true },
  });
  if (!membership || membership.status !== "active") throw new AccessError("no_membership");

  await prisma.user.update({ where: { id: userId }, data: { activeRestaurantId: restaurantId } });
}

export async function listMemberships(
  userId: string
): Promise<{ restaurantId: string; role: Role; name: string }[]> {
  const rows = await prisma.restaurantMembership.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true, role: true, restaurant: { select: { name: true } } },
  });
  return rows
    .filter((r) => isRole(r.role))
    .map((r) => ({ restaurantId: r.restaurantId, role: r.role as Role, name: r.restaurant.name }));
}
