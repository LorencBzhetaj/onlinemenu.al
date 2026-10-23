import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardRestaurant } from "@/modules/memberships/access";
import { isValidHex, ALLOWED_FONTS, ALLOWED_PHOTO_STYLES } from "@/lib/branding";

export async function PUT(req: Request) {
  // restaurantId përcillet shprehimisht (header x-restaurant-id) dhe validohet me membership.
  const g = await guardRestaurant(req, "branding:write");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;

  const body = await req.json().catch(() => ({}));
  const primaryColor = String(body.primaryColor ?? "").trim();
  const accentColor = String(body.accentColor ?? "").trim();
  const fontHeading = String(body.fontHeading ?? "").trim();
  const fontBody = String(body.fontBody ?? "").trim();
  const logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
  const menuPhotoStyle = String(body.menuPhotoStyle ?? "none").trim();

  // Validim ngjyrash
  if (!isValidHex(primaryColor) || !isValidHex(accentColor)) {
    return NextResponse.json(
      { error: "Ngjyrat duhet të jenë hex valid (p.sh. #1a2b3c)." },
      { status: 400 }
    );
  }
  // Validim fontesh (vetëm nga lista e lejuar)
  if (!ALLOWED_FONTS.has(fontHeading) || !ALLOWED_FONTS.has(fontBody)) {
    return NextResponse.json(
      { error: "Fonti i zgjedhur nuk lejohet." },
      { status: 400 }
    );
  }
  // Validim i stilit të fotos
  if (!ALLOWED_PHOTO_STYLES.has(menuPhotoStyle)) {
    return NextResponse.json({ error: "Stili i fotos nuk lejohet." }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { primaryColor, accentColor, fontHeading, fontBody, logoUrl, menuPhotoStyle },
    select: {
      primaryColor: true,
      accentColor: true,
      fontHeading: true,
      fontBody: true,
      logoUrl: true,
      menuPhotoStyle: true,
    },
  });

  return NextResponse.json({ ok: true, restaurant });
}
