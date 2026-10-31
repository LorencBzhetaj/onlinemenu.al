import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardBooking } from "@/modules/booking/guards";

export const dynamic = "force-dynamic";

/** Klientët e këtij restoranti (me numrin e rezervimeve). customers:read. */
export async function GET(req: Request) {
  const g = await guardBooking(req, "customers:read", { requireModule: false });
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const customers = await prisma.customer.findMany({
    where: {
      restaurantId: g.ctx.restaurantId,
      ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, notes: true, _count: { select: { reservations: true } } },
  });
  return NextResponse.json({ customers });
}
