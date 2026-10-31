import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { updateBookingSettings, type BookingSettingsPatch } from "@/modules/booking/config";
import { isValidTimeZone } from "@/modules/booking/timezone";

export const dynamic = "force-dynamic";

type NumKey = "turnDurationMinutes" | "bookingInterval" | "seatingBuffer" | "maxPartySize" | "maxReservationsPerSlot" | "maxCoversPerSlot";
const NUM_FIELDS: NumKey[] = [
  "turnDurationMinutes", "bookingInterval", "seatingBuffer", "maxPartySize", "maxReservationsPerSlot", "maxCoversPerSlot",
];

/** Përditëson politikat e booking-ut. booking:config. */
export async function PATCH(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const patch: BookingSettingsPatch = {};
  for (const f of NUM_FIELDS) {
    if (b[f] !== undefined) {
      const n = Math.trunc(Number(b[f]));
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `Vlerë e pavlefshme për ${f}.` }, { status: 400 });
      patch[f] = n;
    }
  }
  if (b.timezone !== undefined) {
    if (!isValidTimeZone(String(b.timezone))) return NextResponse.json({ error: "Zonë kohore e pavlefshme." }, { status: 400 });
    patch.timezone = String(b.timezone);
  }
  const s = await updateBookingSettings(g.ctx.restaurantId, patch);
  return NextResponse.json({ ok: true, settings: s });
}
