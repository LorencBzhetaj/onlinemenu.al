import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { parseCoord } from "@/modules/restaurants/location";

const MAX_TEXT = 80;

function optText(v: unknown, max = MAX_TEXT): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function PUT(req: Request) {
  // restaurantId përcillet shprehimisht (header x-restaurant-id) dhe validohet me membership.
  const g = await guardRestaurant(req, "settings:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));

  // ── Identiteti ──
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Emri është i detyrueshëm." }, { status: 400 });
  }
  // SLUG nuk përditësohet KURRË nga kjo rrugë (injorohet edhe nëse dërgohet).

  // ── Hero ──
  const taglineAl = optText(body.taglineAl);
  const taglineEn = optText(body.taglineEn);
  const subtitleAl = optText(body.subtitleAl);
  const subtitleEn = optText(body.subtitleEn);

  let estYear: number | null = null;
  if (body.estYear !== undefined && body.estYear !== null && String(body.estYear).trim() !== "") {
    const y = Math.trunc(Number(body.estYear));
    const currentYear = new Date().getFullYear();
    if (!Number.isFinite(y) || y < 1800 || y > currentYear) {
      return NextResponse.json(
        { error: `Viti i themelimit duhet të jetë mes 1800 dhe ${currentYear}.` },
        { status: 400 }
      );
    }
    estYear = y;
  }

  // ── Kontakti ──
  const phoneRaw = String(body.phone ?? "").trim();
  if (phoneRaw && !/^[0-9+\s-]+$/.test(phoneRaw)) {
    return NextResponse.json(
      { error: "Telefoni lejon vetëm numra, hapësira, '+' dhe '-'." },
      { status: 400 }
    );
  }
  const phone = phoneRaw || null;

  const whatsappRaw = String(body.whatsapp ?? "").trim();
  if (whatsappRaw && !/^\d{8,15}$/.test(whatsappRaw)) {
    return NextResponse.json(
      { error: "WhatsApp duhet të jetë numër ndërkombëtar pa '+', vetëm shifra (8-15)." },
      { status: 400 }
    );
  }
  const whatsapp = whatsappRaw || null;

  const address = optText(body.address, 200);
  // ── Zbulimi/kërkimi (Faza 6/7): qytet + kuzhinë që pronari plotëson të dhënat e kërkimit ──
  const city = optText(body.city);
  const cuisine = optText(body.cuisine);

  // ── Koordinatat e pinit (opsionale): të dyja ose asnjëra; jashtë kufijve → 400 ──
  const latRaw = String(body.latitude ?? "").trim();
  const lngRaw = String(body.longitude ?? "").trim();
  const latitude = parseCoord(latRaw, "lat");
  const longitude = parseCoord(lngRaw, "lng");
  if ((latRaw && latitude === null) || (lngRaw && longitude === null) || (latitude === null) !== (longitude === null)) {
    return NextResponse.json(
      { error: "Koordinatat duhet të jenë të dyja numra (gjerësia -90…90, gjatësia -180…180) ose bosh." },
      { status: 400 }
    );
  }

  // ── Përshkrimi i profilit (opsional, më i gjatë) ──
  const aboutAl = optText(body.aboutAl, 600);
  const aboutEn = optText(body.aboutEn, 600);

  // ── Publikimi ──
  const isPublished = Boolean(body.isPublished);

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name,
      estYear,
      taglineAl,
      taglineEn,
      subtitleAl,
      subtitleEn,
      phone,
      whatsapp,
      address,
      city,
      cuisine,
      latitude,
      longitude,
      aboutAl,
      aboutEn,
      isPublished,
    },
    select: {
      latitude: true,
      longitude: true,
      name: true,
      estYear: true,
      taglineAl: true,
      taglineEn: true,
      subtitleAl: true,
      subtitleEn: true,
      phone: true,
      whatsapp: true,
      address: true,
      city: true,
      cuisine: true,
      aboutAl: true,
      aboutEn: true,
      isPublished: true,
    },
  });

  return NextResponse.json({ ok: true, restaurant });
}
