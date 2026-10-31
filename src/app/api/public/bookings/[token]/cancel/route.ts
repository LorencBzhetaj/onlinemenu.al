import { NextResponse } from "next/server";
import { cancelReservationByToken } from "@/modules/booking/reservations";
import { runNotificationWorker } from "@/modules/booking/notifications";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Anulim nga klienti me token (POST). Idempotent; njoftimi dërgohet pas commit-it. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!(await rateLimit(`cancel:${clientIp(req)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: "Shumë kërkesa." }, { status: 429 });
  }
  const res = await cancelReservationByToken(params.token);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  // Gjej restaurantId për worker-in (best-effort).
  const r = await prisma.reservation.findUnique({ where: { cancelToken: params.token }, select: { restaurantId: true } });
  if (r) runNotificationWorker({ restaurantId: r.restaurantId }).catch(() => {});

  return NextResponse.json({ ok: true });
}
