import { NextResponse } from "next/server";
import { guardBooking } from "@/modules/booking/guards";
import { deleteCustomer } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

/** Fshirje klienti — politikë eksplicite: refuzohet nëse ka rezervime. customers:write. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guardBooking(req, "customers:write", { requireModule: false });
  if ("error" in g) return g.error;
  const res = await deleteCustomer(g.ctx.restaurantId, params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
