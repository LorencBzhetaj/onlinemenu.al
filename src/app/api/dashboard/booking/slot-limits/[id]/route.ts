import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { deleteSlotLimit } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guardBooking(req, "booking:config");
  if ("error" in g) return g.error;
  const res = await deleteSlotLimit(g.ctx.restaurantId, params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
