import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { setReservationStatus, type ReservationStatus } from "@/modules/booking/reservations";
import { flushNotificationsAfterCommit } from "@/modules/booking/notifications";

export const dynamic = "force-dynamic";

/** Ndryshim statusi rezervimi (Seated/Completed/Cancelled/NoShow…). reservations:write. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardBooking(req, "reservations:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));
  const res = await setReservationStatus(restaurantId, params.id, String(body.status) as ReservationStatus);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await flushNotificationsAfterCommit(restaurantId);
  return NextResponse.json({ ok: true });
}
