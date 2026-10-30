import { NextResponse } from "next/server";
import {
  guardRestaurant,
  requireRestaurantAccess,
  accessErrorStatus,
  AccessError,
  type AccessContext,
} from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";

/**
 * Guard për rrugët private të booking-ut: kombinon kontrollin e rolit (Faza 1,
 * `reservations:*`/`customers:*`) me entitlement-in BOOKING. Përdoret nga rrugët e
 * Fazës 5. Kthen ose kontekstin ose një përgjigje gati 4xx.
 *
 * Leximet (reservations:read/customers:read) NUK kërkojnë BOOKING aktiv — stafi
 * sheh historikun edhe kur moduli ka skaduar (sipas masterplanit §7). Shkrimet
 * (reservations:write) e kërkojnë BOOKING aktiv.
 */
export async function guardBooking(
  req: Request,
  action: string,
  opts: { requireModule?: boolean } = {}
): Promise<{ ctx: AccessContext } | { error: NextResponse }> {
  const g = await guardRestaurant(req, action);
  if ("error" in g) return g;
  const requireModule = opts.requireModule ?? action.endsWith(":write");
  if (requireModule && !(await hasEntitlement(g.ctx.restaurantId, "BOOKING"))) {
    return { error: NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 }) };
  }
  return g;
}

/** Variant pa Request (p.sh. server actions): rilexon sesionin + membership + modul. */
export async function requireBookingAccess(
  action: string,
  restaurantId: string | null | undefined,
  opts: { requireModule?: boolean } = {}
): Promise<AccessContext> {
  const ctx = await requireRestaurantAccess(action, restaurantId);
  const requireModule = opts.requireModule ?? action.endsWith(":write");
  if (requireModule && !(await hasEntitlement(ctx.restaurantId, "BOOKING"))) {
    throw new AccessError("forbidden");
  }
  return ctx;
}

export { accessErrorStatus };
