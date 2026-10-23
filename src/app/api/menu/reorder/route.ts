import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";

type ReorderType = "category" | "subcategory" | "item";

/**
 * POST — ri-rendit një listë. Body: { type, ids: [id në rendin e ri] }.
 * sortOrder caktohet sipas indeksit. Nëse NDONJË id nuk i përket restorantit,
 * kërkesa refuzohet E TËRË (jo sukses i pjesshëm i heshtur).
 */
export async function POST(req: Request) {
  const g = await guardRestaurant(req, "menu:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  if (!(await hasEntitlement(restaurantId, "MENU"))) {
    return NextResponse.json({ error: "MODULE_INACTIVE" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type as ReorderType;
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];

  if (!["category", "subcategory", "item"].includes(type) || ids.length === 0) {
    return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  }

  // Gjej vetëm ID-të që i përkasin këtij restoranti (filtër izolimi).
  let ownedIds: Set<string>;
  if (type === "category") {
    const rows = await prisma.category.findMany({
      where: { restaurantId, id: { in: ids } },
      select: { id: true },
    });
    ownedIds = new Set(rows.map((r) => r.id));
  } else if (type === "subcategory") {
    const rows = await prisma.subcategory.findMany({
      where: { category: { restaurantId }, id: { in: ids } },
      select: { id: true },
    });
    ownedIds = new Set(rows.map((r) => r.id));
  } else {
    const rows = await prisma.menuItem.findMany({
      where: {
        id: { in: ids },
        OR: [
          { category: { restaurantId } },
          { subcategory: { category: { restaurantId } } },
        ],
      },
      select: { id: true },
    });
    ownedIds = new Set(rows.map((r) => r.id));
  }

  // Refuzim i tërë nëse ndonjë id nuk i përket restorantit (pa sukses të pjesshëm).
  const foreign = ids.filter((id) => !ownedIds.has(id));
  if (foreign.length > 0) {
    return NextResponse.json({ error: "Disa objekte nuk i përkasin restorantit." }, { status: 403 });
  }

  const updates = ids.map((id, index) => ({ id, sortOrder: index }));

  await prisma.$transaction(
    updates.map((u) => {
      const data = { sortOrder: u.sortOrder };
      const where = { id: u.id };
      if (type === "category") return prisma.category.update({ where, data });
      if (type === "subcategory") return prisma.subcategory.update({ where, data });
      return prisma.menuItem.update({ where, data });
    })
  );

  return NextResponse.json({ ok: true, updated: updates.length });
}
