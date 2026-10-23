import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { selectActiveRestaurant } from "@/modules/memberships/active-restaurant";
import { AccessError, accessErrorStatus } from "@/modules/memberships/access";

// Zgjedh restorantin aktiv (membership i vlefshëm; jo restaurantId arbitrar).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const restaurantId = String(body.restaurantId ?? "").trim();
  if (!restaurantId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    await selectActiveRestaurant(session.user.id, restaurantId);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.code }, { status: accessErrorStatus(e.code) });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
