import { prisma } from "@/lib/prisma";

export type Module = "MENU" | "BOOKING";

// Allowlist (jo denylist): status i panjohur → jo i lejuar.
const SUBSCRIPTION_OK = new Set(["trial", "active"]);
const MODULE_OK = new Set(["active"]);

/**
 * A ka restoranti të drejtën aktive për modulin? Vlerësim me allowlist, sipas
 * tabelës së vendimeve (docs/architecture/phase-1-spec-and-plan.md §5):
 *   mungesë të dhënash → false; pezullim → false; status jashtë allowlist → false;
 *   expiresAt <= now → i skaduar → false.
 * Lexohet NË SERVER në çdo kërkesë (cron-i vetëm raporton).
 */
export async function hasEntitlement(restaurantId: string | null | undefined, module: Module): Promise<boolean> {
  if (!restaurantId) return false;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      suspendedAt: true,
      subscription: {
        select: {
          status: true,
          expiresAt: true,
          entitlements: { where: { module }, select: { status: true, expiresAt: true } },
        },
      },
    },
  });

  if (!restaurant) return false; // të dhëna të nevojshme mungojnë
  if (restaurant.suspendedAt) return false; // pezullim

  const sub = restaurant.subscription;
  if (!sub) return false;
  if (!SUBSCRIPTION_OK.has(sub.status)) return false; // allowlist subscription

  const ent = sub.entitlements[0];
  if (!ent) return false;
  if (!MODULE_OK.has(ent.status)) return false; // allowlist moduli

  const now = new Date();
  if (ent.expiresAt && ent.expiresAt <= now) return false; // skadim moduli (<= now)
  if (sub.expiresAt && sub.expiresAt <= now) return false; // skadim abonimi (<= now)

  return true;
}
