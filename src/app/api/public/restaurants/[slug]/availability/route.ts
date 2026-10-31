import { NextResponse } from "next/server";
import { getPublicProfile } from "@/modules/restaurants/public-profile";
import { getAvailableTimes, type RequestedArea } from "@/modules/booking/availability";

export const dynamic = "force-dynamic";

/** Disponueshmëria publike për një restorant + datë + grup (opsionalisht zonë). BOOKING aktiv. */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const p = await getPublicProfile(params.slug);
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!p.gate.isPublished || p.gate.suspended || !p.gate.bookingActive) {
    return NextResponse.json({ slots: [], inactive: true });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const partySize = Math.trunc(Number(url.searchParams.get("partySize")));
  const areaRaw = url.searchParams.get("area");
  const requestedArea: RequestedArea = areaRaw === "indoor" || areaRaw === "outdoor" ? areaRaw : "no_preference";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad_date" }, { status: 400 });
  if (!Number.isFinite(partySize) || partySize <= 0) return NextResponse.json({ error: "bad_party" }, { status: 400 });

  const slots = await getAvailableTimes({ restaurantId: p.id, dateStr: date, partySize, requestedArea });
  return NextResponse.json({ slots });
}
