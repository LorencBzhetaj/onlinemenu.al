import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { setOpeningHours, type OpeningHourInput } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

/** Zëvendëson plotësisht orarin javor. booking:config. */
export async function PUT(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const hours: OpeningHourInput[] = Array.isArray(b.hours)
    ? b.hours.map((h: Record<string, unknown>) => ({
        dayOfWeek: Math.trunc(Number(h.dayOfWeek)),
        startTime: String(h.startTime ?? ""),
        endTime: String(h.endTime ?? ""),
        lastBookingTime: h.lastBookingTime ? String(h.lastBookingTime) : null,
        isActive: h.isActive === undefined ? true : Boolean(h.isActive),
      }))
    : [];
  const res = await setOpeningHours(g.ctx.restaurantId, hours);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
