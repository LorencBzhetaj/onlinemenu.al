import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { createArea } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  if (!String(b.name ?? "").trim()) return NextResponse.json({ error: "Emri është i detyrueshëm." }, { status: 400 });
  const a = await createArea(g.ctx.restaurantId, { name: String(b.name).trim(), kind: b.kind, weatherDependent: Boolean(b.weatherDependent) });
  return NextResponse.json(a, { status: 201 });
}
