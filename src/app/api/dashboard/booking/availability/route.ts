import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { getAvailableTimes, type RequestedArea } from "@/modules/booking/availability";

export const dynamic = "force-dynamic";

/** Orë të lira për stafin (riplanifikim). reservations:read. */
export async function GET(req: Request) {
  const g = await guardBooking(req, "reservations:read", { requireModule: false });
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const partySize = Math.trunc(Number(url.searchParams.get("partySize")));
  const areaRaw = url.searchParams.get("area");
  const area: RequestedArea = areaRaw === "indoor" || areaRaw === "outdoor" ? areaRaw : "no_preference";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(partySize) || partySize <= 0) {
    return NextResponse.json({ error: "bad_params" }, { status: 400 });
  }
  const slots = await getAvailableTimes({ restaurantId: g.ctx.restaurantId, dateStr: date, partySize, requestedArea: area });
  return NextResponse.json({ slots });
}
