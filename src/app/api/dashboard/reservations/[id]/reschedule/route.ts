import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { rescheduleReservation } from "@/modules/booking/reservations";
import { flushNotificationsAfterCommit } from "@/modules/booking/notifications";

export const dynamic = "force-dynamic";

/** Riplanifikim nga stafi (v1: klienti s'riplanifikon vetë). reservations:write + BOOKING. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardBooking(req, "reservations:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));
  const res = await rescheduleReservation(restaurantId, params.id, String(body.start ?? ""), body.tableId ? String(body.tableId) : undefined);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await flushNotificationsAfterCommit(restaurantId);
  return NextResponse.json({ ok: true });
}
