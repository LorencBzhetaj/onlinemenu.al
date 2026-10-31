import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { createInvitation } from "@/modules/memberships/invitations";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Krijon një ftesë MANAGER/STAFF. team:write (vetëm OWNER). Kthen linkun e ftesës. */
export async function POST(req: Request) {
  const g = await guardRestaurant(req, "team:write");
  if ("error" in g) return g.error;

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "");
  const role = String(body.role ?? "");

  const actor = await prisma.user.findUnique({ where: { id: g.ctx.userId }, select: { email: true } });
  const res = await createInvitation({
    restaurantId: g.ctx.restaurantId,
    email,
    role,
    invitedByUserId: g.ctx.userId,
    invitedByEmail: actor?.email ?? null,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  // Pa dërgime reale emaili (Faza 7): kthehet linku që pronari e ndan vetë.
  return NextResponse.json({ ok: true, inviteUrl: absoluteUrl(`/invite/${res.token}`) }, { status: 201 });
}
