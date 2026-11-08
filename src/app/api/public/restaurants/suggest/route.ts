import { NextResponse } from "next/server";
import { suggestRestaurants } from "@/modules/restaurants/search";

export const dynamic = "force-dynamic";

/**
 * Sugjerime publike të emrave (nga 2 karaktere): vetëm restorante me menu publike të hapshme
 * (publikim + pa pezullim + MENU). Kthen vetëm emrin, slug-un, qytetin dhe kuzhinën.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 80);
  const city = u.searchParams.get("city");
  const items = await suggestRestaurants(q, city);
  return NextResponse.json({ q, items }, { headers: { "cache-control": "public, max-age=30" } });
}
