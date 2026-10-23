import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, roleCan, isRole } from "./permissions";

/** Header-i me të cilin faqja/formulari përcjell shprehimisht restorantin e vet. */
export const RESTAURANT_HEADER = "x-restaurant-id";

export type AccessContext = { userId: string; restaurantId: string; role: Role };

export type AccessErrorCode =
  | "unauthenticated" // s'ka sesion
  | "bad_request" // restaurantId mungon (p.sh. header x-restaurant-id i munguar)
  | "no_membership" // s'ka membership aktiv për këtë restaurantId
  | "forbidden"; // roli s'e lejon action-in (ose action i panjohur)

export class AccessError extends Error {
  constructor(public code: AccessErrorCode) {
    super(code);
    this.name = "AccessError";
  }
}

/**
 * Autoriteti i lejeve pa sesion — rilexon membership-in NGA DB (jo nga JWT).
 * `restaurantId` vjen SHPREHIMISHT nga konteksti i kërkesës (header x-restaurant-id
 * për API, ose id-ja e zgjidhur në SSR për faqet), kurrë nga activeRestaurantId.
 */
export async function resolveAccess(
  userId: string,
  action: string,
  restaurantId: string | null | undefined
): Promise<AccessContext> {
  if (!restaurantId) throw new AccessError("bad_request");

  const membership = await prisma.restaurantMembership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "active" || !isRole(membership.role)) {
    throw new AccessError("no_membership");
  }
  if (!roleCan(membership.role, action)) throw new AccessError("forbidden");

  return { userId, restaurantId, role: membership.role };
}

/**
 * Guard-i për rrugët private dhe faqet server-side. Merr sesionin dhe delegon te
 * resolveAccess. ASNjë fallback te activeRestaurantId — restaurantId jepet shprehimisht.
 */
export async function requireRestaurantAccess(
  action: string,
  restaurantId: string | null | undefined
): Promise<AccessContext> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new AccessError("unauthenticated");
  return resolveAccess(userId, action, restaurantId);
}

/** Përkthen AccessError → status HTTP (pa zbuluar detaje të panevojshme). */
export function accessErrorStatus(code: AccessErrorCode): number {
  switch (code) {
    case "unauthenticated":
      return 401;
    case "bad_request":
      return 400;
    case "no_membership":
    case "forbidden":
      return 403;
  }
}

/**
 * Për FAQET server-side: zgjidh restorantin aktiv të sesionit (hint nga JWT) si
 * restorantin e lidhur me faqen, dhe kontrollo lejen për `action`. Faqja pastaj e
 * përcjell këtë restaurantId te komponentët klient (që e vendosin header-in).
 */
export async function pageAccess(
  action: string
): Promise<{ ok: true; ctx: AccessContext } | { ok: false; reason: AccessErrorCode }> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return { ok: false, reason: "unauthenticated" };
    const ctx = await resolveAccess(userId, action, session.user.restaurantId);
    return { ok: true, ctx };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, reason: e.code };
    throw e;
  }
}

/** restaurantId i përcjellë shprehimisht nga faqja/formulari (header x-restaurant-id). */
export function restaurantIdFromRequest(req: Request): string | null {
  const v = req.headers.get(RESTAURANT_HEADER);
  return v && v.trim() ? v.trim() : null;
}

/**
 * Guard për rrugët private të API-t: lexon restorantin nga header-i, kontrollon lejen,
 * dhe kthen ose kontekstin ose një përgjigje gati 401/403/400. Përdorim:
 *   const g = await guardRestaurant(req, "menu:write");
 *   if ("error" in g) return g.error;
 *   const { restaurantId } = g.ctx;
 */
export async function guardRestaurant(
  req: Request,
  action: string
): Promise<{ ctx: AccessContext } | { error: NextResponse }> {
  try {
    const ctx = await requireRestaurantAccess(action, restaurantIdFromRequest(req));
    return { ctx };
  } catch (e) {
    if (e instanceof AccessError) {
      return { error: NextResponse.json({ error: e.code }, { status: accessErrorStatus(e.code) }) };
    }
    throw e;
  }
}
