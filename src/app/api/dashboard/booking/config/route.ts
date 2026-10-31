import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardBooking } from "@/modules/booking/guards";
import { ensureBookingSettings } from "@/modules/booking/config";

export const dynamic = "force-dynamic";

/** Gjithë konfigurimi i booking-ut për faqet e panelit (lexim). */
export async function GET(req: Request) {
  const g = await guardBooking(req, "reservations:read", { requireModule: false });
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const [settings, areas, tables, combinations, hours, closures, areaClosures, slotLimits] = await Promise.all([
    ensureBookingSettings(restaurantId),
    prisma.area.findMany({ where: { restaurantId }, orderBy: [{ priority: "asc" }, { sortOrder: "asc" }] }),
    prisma.restaurantTable.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } }),
    prisma.tableCombination.findMany({ where: { restaurantId }, include: { members: { select: { tableId: true } } } }),
    prisma.openingHour.findMany({ where: { restaurantId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.closure.findMany({ where: { restaurantId }, orderBy: { startDate: "asc" } }),
    prisma.areaClosure.findMany({ where: { restaurantId }, orderBy: { startDateTime: "asc" } }),
    prisma.slotLimit.findMany({ where: { restaurantId }, orderBy: { time: "asc" } }),
  ]);

  return NextResponse.json({ settings, areas, tables, combinations, hours, closures, areaClosures, slotLimits });
}
