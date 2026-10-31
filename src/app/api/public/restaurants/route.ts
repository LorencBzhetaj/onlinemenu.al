import { NextResponse } from "next/server";
import { parseSearchParams, searchRestaurants } from "@/modules/restaurants/search";

export const dynamic = "force-dynamic";

/**
 * Kërkimi publik i restoranteve (Faza 6). Publik; kthen VETËM profile të publikuara
 * dhe jo të pezulluara. Filtrat/pagination validohen te shërbimi; disponueshmëria
 * (nëse date+guests) vjen vetëm nga motori real për faqen aktuale të rezultateve.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    raw[k] = v;
  });
  const filters = parseSearchParams(raw);
  const result = await searchRestaurants(filters);
  return NextResponse.json(result);
}
