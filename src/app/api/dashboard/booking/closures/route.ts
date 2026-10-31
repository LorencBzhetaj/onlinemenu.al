import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { createClosure } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const start = new Date(String(b.startDate ?? ""));
  const end = new Date(String(b.endDate ?? b.startDate ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Datat janë të pavlefshme." }, { status: 400 });
  }
  const c = await createClosure(g.ctx.restaurantId, { startDate: start, endDate: end, reason: b.reason ? String(b.reason) : undefined });
  return NextResponse.json(c, { status: 201 });
}
