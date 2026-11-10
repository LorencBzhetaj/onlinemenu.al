import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardBooking } from "@/modules/booking/guards";
import { createWalkIn } from "@/modules/booking/reservations";
import { flushNotificationsAfterCommit } from "@/modules/booking/notifications";
import { getSettings } from "@/modules/booking/availability";
import { toBusinessDateKey, businessDateAtMinutes } from "@/modules/booking/timezone";

export const dynamic = "force-dynamic";

/** Lista e rezervimeve për një datë (default sot, zona e restorantit). reservations:read. */
export async function GET(req: Request) {
  const g = await guardBooking(req, "reservations:read", { requireModule: false });
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const settings = await getSettings(restaurantId);
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || toBusinessDateKey(new Date(), settings.timezone);
  const dayStart = businessDateAtMinutes(date, 0, settings.timezone);
  const dayEnd = businessDateAtMinutes(date, 24 * 60, settings.timezone);

  const rows = await prisma.reservation.findMany({
    where: { restaurantId, startDateTime: { gte: dayStart, lt: dayEnd } },
    orderBy: { startDateTime: "asc" },
    select: {
      id: true, status: true, partySize: true, startDateTime: true, source: true, notes: true, requestedArea: true,
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
      table: { select: { name: true, area: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ date, reservations: rows });
}

/** Krijim walk-in/telefon nga stafi. reservations:write + BOOKING aktiv. */
export async function POST(req: Request) {
  const g = await guardBooking(req, "reservations:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));
  const res = await createWalkIn({
    restaurantId,
    start: String(body.start ?? ""),
    partySize: Number(body.partySize),
    firstName: String(body.firstName ?? ""),
    lastName: body.lastName ? String(body.lastName) : undefined,
    phone: String(body.phone ?? ""),
    email: body.email ? String(body.email) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
    requestedArea: body.requestedArea,
    tableId: body.tableId ? String(body.tableId) : "any",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await flushNotificationsAfterCommit(restaurantId);
  return NextResponse.json(res.data, { status: 201 });
}
