import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { createTable } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const res = await createTable(g.ctx.restaurantId, {
    name: String(b.name ?? "").trim(),
    seats: Number(b.seats),
    section: b.section ? String(b.section) : "",
    areaId: b.areaId ? String(b.areaId) : null,
    shape: b.shape ? String(b.shape) : "square",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res.data, { status: 201 });
}
