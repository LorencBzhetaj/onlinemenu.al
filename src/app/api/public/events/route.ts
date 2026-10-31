import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEventType, PUBLIC_EVENT_TYPES, recordEvent, type EventType } from "@/modules/analytics/events";

export const dynamic = "force-dynamic";

/**
 * Beacon publik analitike (Faza 7). Pranon vetëm eventet publike (jo booking_created) dhe
 * vetëm për restorante të publikuara e jo të pezulluara. Pa PII — vetëm tipi/itemId/meta.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "").trim();
  const type = body.type;
  if (!slug || !isEventType(type) || !PUBLIC_EVENT_TYPES.has(type as EventType)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, isPublished: true, suspendedAt: true },
  });
  // Vetëm profile publike; mospranimi i heshtur (204) për të mos zbuluar gjendjen.
  if (!restaurant || !restaurant.isPublished || restaurant.suspendedAt) {
    return new NextResponse(null, { status: 204 });
  }

  // item_view: itemId duhet t'i përkasë KËTIJ restoranti (izolim tenant), përndryshe hiqet.
  let itemId: string | null = null;
  if (type === "item_view" && typeof body.itemId === "string" && body.itemId) {
    const item = await prisma.menuItem.findFirst({
      where: {
        id: body.itemId,
        OR: [
          { category: { restaurantId: restaurant.id } },
          { subcategory: { category: { restaurantId: restaurant.id } } },
        ],
      },
      select: { id: true },
    });
    itemId = item?.id ?? null;
  }

  const meta = type === "wolt_click" ? "WOLT" : null;
  await recordEvent({ restaurantId: restaurant.id, type: type as EventType, itemId, meta });
  return new NextResponse(null, { status: 204 });
}
