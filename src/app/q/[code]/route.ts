import { NextResponse } from "next/server";
import { resolveQrCode } from "@/modules/restaurants/qr";

export const dynamic = "force-dynamic";

/**
 * Resolver i QR-së: `/q/[code]` → profili i restorantit `/restaurants/[slug]`.
 * QR-ja hap PROFILIN (jo menunë direkt). Kodi është opak e i pandryshueshëm:
 * ndryshimi i emrit/menusë s'e prek. Publikimi/pezullimi kontrollohet te profili.
 */
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const r = await resolveQrCode(params.code);
  if (!r) {
    // Kod i panjohur → kryefaqja (pa zbuluar ekzistencën e kodeve).
    return NextResponse.redirect(new URL("/", _req.url), { status: 307 });
  }
  return NextResponse.redirect(new URL(`/restaurants/${r.slug}`, _req.url), { status: 307 });
}
