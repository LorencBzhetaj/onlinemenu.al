import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedRestaurantId } from "@/lib/api-auth";

const MAX_TEXT = 80;

function optText(v: unknown, max = MAX_TEXT): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function PUT(req: Request) {
  // restaurantId nga sesioni (JWT), JO nga body.
  const restaurantId = await getAuthedRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }

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
      isPublished,
    },
    select: {
      name: true,
      estYear: true,
      taglineAl: true,
      taglineEn: true,
      subtitleAl: true,
      subtitleEn: true,
      phone: true,
      whatsapp: true,
      address: true,
      isPublished: true,
    },
  });

  return NextResponse.json({ ok: true, restaurant });
}
