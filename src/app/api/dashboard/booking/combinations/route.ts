import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { createCombination } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const res = await createCombination(g.ctx.restaurantId, {
    name: String(b.name ?? "").trim(),
    areaId: String(b.areaId ?? ""),
    maxSeats: Number(b.maxSeats),
    minSeats: b.minSeats != null ? Number(b.minSeats) : null,
    memberTableIds: Array.isArray(b.memberTableIds) ? b.memberTableIds.map(String) : [],
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res.data, { status: 201 });
}
