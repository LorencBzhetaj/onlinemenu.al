import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Analytics (Faza 7) — evente reale, tenant-scoped, PA token/email/telefon.
 * Tipet: profile_view, menu_view, item_view, wolt_click, booking_created.
 * Agregimet llogariten mbi `AnalyticsEvent`; asgjë nuk shpiket.
 */
export const EVENT_TYPES = ["profile_view", "menu_view", "item_view", "wolt_click", "booking_created"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Vetëm këto pranohen nga beacon-i publik (klienti). `booking_created` regjistrohet
// VETËM në server (motori i booking-ut) — s'pranohet nga publiku për të mos u fryrë.
export const PUBLIC_EVENT_TYPES = new Set<EventType>(["profile_view", "menu_view", "item_view", "wolt_click"]);

export function isEventType(x: unknown): x is EventType {
  return typeof x === "string" && (EVENT_TYPES as readonly string[]).includes(x);
}

/** Regjistron një event. Best-effort: dështimi s'rrëzon veprimin kryesor. */
export async function recordEvent(
  input: { restaurantId: string; type: EventType; itemId?: string | null; meta?: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  try {
    await client.analyticsEvent.create({
      data: {
        restaurantId: input.restaurantId,
        type: input.type,
        itemId: input.itemId ?? null,
        meta: input.meta ? input.meta.slice(0, 40) : null,
      },
    });
  } catch (e) {
    console.error("analytics.record.failed", input.type, e);
  }
}

export type AnalyticsSummary = {
  days: number;
  totals: Record<EventType, number>;
  topItems: { itemId: string; name: string; count: number }[];
  total: number;
};

/**
 * Përmbledhje tenant-scoped për `days` ditët e fundit. Agregime pa PII. `topItems` kthen
 * pjatat më të klikuara (item_view) me emrin aktual; itemId-të që s'ekzistojnë më anashkalohen.
 */
export async function getAnalyticsSummary(restaurantId: string, days = 30): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - days * 86400000);

  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["type"],
    where: { restaurantId, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const totals = Object.fromEntries(EVENT_TYPES.map((t) => [t, 0])) as Record<EventType, number>;
  for (const g of grouped) {
    if (isEventType(g.type)) totals[g.type] = g._count._all;
  }
  const total = Object.values(totals).reduce((s, n) => s + n, 0);

  const topRaw = await prisma.analyticsEvent.groupBy({
    by: ["itemId"],
    where: { restaurantId, type: "item_view", createdAt: { gte: since }, itemId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { itemId: "desc" } },
    take: 10,
  });
  const itemIds = topRaw.map((r) => r.itemId).filter((x): x is string => !!x);
  const items = itemIds.length
    ? await prisma.menuItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, nameAl: true } })
    : [];
  const nameById = new Map(items.map((i) => [i.id, i.nameAl]));
  const topItems = topRaw
    .filter((r) => r.itemId && nameById.has(r.itemId))
    .map((r) => ({ itemId: r.itemId as string, name: nameById.get(r.itemId as string)!, count: r._count._all }));

  return { days, totals, topItems, total };
}
