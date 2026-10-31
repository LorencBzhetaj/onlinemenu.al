import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptInvitation } from "@/modules/memberships/invitations";

export const dynamic = "force-dynamic";

/**
 * Pranon një ftesë për user-in e kyçur. Kërkon sesion; email-i i user-it duhet të përputhet
 * me email-in e ftesës. NUK përdor guardRestaurant (përdoruesi ende s'është anëtar).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const res = await acceptInvitation({ token, userId, userEmail: me.email });
  if (!res.ok) {
    const status = res.error === "email_mismatch" ? 403 : res.error === "not_found" ? 404 : 410;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, restaurantId: res.restaurantId, role: res.role });
}
