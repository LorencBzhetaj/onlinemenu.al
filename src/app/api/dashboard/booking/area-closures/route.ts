import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { createAreaClosure } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const start = new Date(String(b.startDateTime ?? ""));
  const end = new Date(String(b.endDateTime ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Dritarja e mbylljes është e pavlefshme." }, { status: 400 });
  }
  const res = await createAreaClosure(g.ctx.restaurantId, { areaId: String(b.areaId ?? ""), startDateTime: start, endDateTime: end, reason: b.reason ? String(b.reason) : undefined });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res.data, { status: 201 });
}
