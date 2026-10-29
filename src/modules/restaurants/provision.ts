import type { Prisma } from "@prisma/client";
import { slugify } from "@/lib/slug";
import { generateQrCode } from "./qr";

export const TRIAL_DAYS = 30;

type Tx = Prisma.TransactionClient;

/**
 * Krijon ATOMIKISHT (brenda tx-së së dhënë) gjithçka që i duhet një pronari të ri:
 * Restaurant + Subscription(trial) + membership OWNER + ModuleEntitlement MENU(active)+BOOKING(disabled).
 *
 * IDEMPOTENT: nëse pronari ka tashmë restorant → e kthen pa krijuar tjetër (created:false).
 * SIGURT NDAJ KONKURRENCËS: merr një lock këshillues xact-scoped sipas ownerId, kështu dy
 * kërkesa paralele serializohen (e dyta sheh restorantin e të parës dhe e kthen).
 *
 * Duhet thirrur BRENDA një transaksioni (lock-u xact-scoped). Kthen restaurantId+slug+created.
 */
export async function createRestaurantForOwner(
  tx: Tx,
  ownerId: string,
  name: string
): Promise<{ restaurantId: string; slug: string; created: boolean }> {
  // Lock këshillues (xact-scoped) sipas ownerId → serializon kërkesat paralele për të njëjtin pronar.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId})::bigint)`;

  const existing = await tx.restaurant.findFirst({
    where: { ownerId },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { restaurantId: existing.id, slug: existing.slug, created: false };

  const base = slugify(name) || "restoranti";
  let slug = base;
  let n = 1;
  while (await tx.restaurant.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

  const restaurant = await tx.restaurant.create({
    data: {
      name,
      slug,
      owner: { connect: { id: ownerId } },
      subscription: {
        create: {
          plan: "monthly",
          status: "trial",
          expiresAt,
          // MENU pa skadim moduli (null) → qeveris subscription-i; BOOKING i çaktivizuar deri në Fazën 4/5.
          entitlements: {
            create: [
              { module: "MENU", status: "active", expiresAt: null },
              { module: "BOOKING", status: "disabled", expiresAt: null },
            ],
          },
        },
      },
      // Invariant: OWNER membership = pronari kanonik, krijuar atomikisht me restorantin.
      memberships: {
        create: { role: "OWNER", status: "active", user: { connect: { id: ownerId } } },
      },
      // Kod QR opak, krijuar atomikisht → `/q/[code]` çon te profili publik.
      qrCode: { create: { code: generateQrCode() } },
    },
    select: { id: true, slug: true },
  });

  return { restaurantId: restaurant.id, slug: restaurant.slug, created: true };
}
