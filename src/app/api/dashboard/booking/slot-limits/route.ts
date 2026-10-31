import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { createSlotLimit } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const res = await createSlotLimit(g.ctx.restaurantId, {
    time: String(b.time ?? ""),
    maxReservations: Math.trunc(Number(b.maxReservations)),
    maxCovers: b.maxCovers != null && b.maxCovers !== "" ? Math.trunc(Number(b.maxCovers)) : null,
    dayOfWeek: b.dayOfWeek != null && b.dayOfWeek !== "" ? Math.trunc(Number(b.dayOfWeek)) : null,
    areaKind: b.areaKind ? String(b.areaKind) : null,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res.data, { status: 201 });
}
