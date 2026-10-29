import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { isLinkType, validateLinkUrl } from "@/modules/restaurants/external-links";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardRestaurant(req, "links:read");
  if ("error" in g) return g.error;
  const links = await prisma.restaurantExternalLink.findMany({
    where: { restaurantId: g.ctx.restaurantId },
    select: { type: true, url: true, enabled: true },
  });
  return NextResponse.json({ links });
}

/** Upsert i një lidhjeje sipas llojit. Validim HTTPS + host allowlist (shih external-links.ts). */
export async function PUT(req: Request) {
  const g = await guardRestaurant(req, "links:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));
  const type = body.type;
  if (!isLinkType(type)) {
    return NextResponse.json({ error: "Lloj lidhjeje i panjohur." }, { status: 400 });
  }

  const v = validateLinkUrl(type, String(body.url ?? ""));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  const link = await prisma.restaurantExternalLink.upsert({
    where: { restaurantId_type: { restaurantId, type } },
    create: { restaurantId, type, url: v.url, enabled },
    update: { url: v.url, enabled },
    select: { type: true, url: true, enabled: true },
  });

  return NextResponse.json({ ok: true, link });
}

export async function DELETE(req: Request) {
  const g = await guardRestaurant(req, "links:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));
  const type = body.type;
  if (!isLinkType(type)) {
    return NextResponse.json({ error: "Lloj lidhjeje i panjohur." }, { status: 400 });
  }

  await prisma.restaurantExternalLink.deleteMany({ where: { restaurantId, type } });
  return NextResponse.json({ ok: true });
}
