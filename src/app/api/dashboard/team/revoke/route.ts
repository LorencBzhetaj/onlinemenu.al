import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { revokeMembership, revokeInvitation } from "@/modules/memberships/invitations";

export const dynamic = "force-dynamic";

/**
 * Revokon një anëtar (targetUserId) ose një ftesë pending (invitationId). team:write (OWNER).
 * Invarianti i OWNER dhe izolimi tenant zbatohen te shërbimi.
 */
export async function POST(req: Request) {
  const g = await guardRestaurant(req, "team:write");
  if ("error" in g) return g.error;

  const body = await req.json().catch(() => ({}));
  const actor = await prisma.user.findUnique({ where: { id: g.ctx.userId }, select: { email: true } });

  if (body.invitationId) {
    const okv = await revokeInvitation({
      restaurantId: g.ctx.restaurantId,
      invitationId: String(body.invitationId),
      actorUserId: g.ctx.userId,
      actorEmail: actor?.email ?? null,
    });
    return okv ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (body.targetUserId) {
    const res = await revokeMembership({
      restaurantId: g.ctx.restaurantId,
      targetUserId: String(body.targetUserId),
      actorUserId: g.ctx.userId,
      actorEmail: actor?.email ?? null,
    });
    if (!res.ok) {
      const status = res.error === "not_found" ? 404 : 409;
      return NextResponse.json({ error: res.error }, { status });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
