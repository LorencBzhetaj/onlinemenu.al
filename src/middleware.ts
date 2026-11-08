import { NextResponse, type NextRequest } from "next/server";

// Faza "Së shpejti": publikohet VETËM kryefaqja + skedarët e saj. Çdo rrugë tjetër (panel, admin,
// regjistrim, hyrje, menutë e vjetra /m/*, API-të) kthen 404 noindex — kurrë një kopje të indeksueshme
// të faqes "Së shpejti". Kur të lançohet platforma, ky middleware zëvendësohet.
const ALLOWED_EXACT = new Set(["/", "/robots.txt", "/sitemap.xml", "/icon.png", "/apple-icon.png", "/opengraph-image.jpg", "/favicon.ico"]);
const ALLOWED_PREFIX = ["/coming-soon/", "/brand/"];

const NOT_FOUND_HTML = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Faqja nuk u gjet · OnlineMenu.al</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#4a0f35;color:#fff8ee;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}a{color:#ffe16a;font-weight:700}</style></head><body><main><h1>Faqja nuk u gjet</h1><p><a href="/">Kthehu te OnlineMenu.al</a></p></main></body></html>`;

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (ALLOWED_EXACT.has(path) || ALLOWED_PREFIX.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" },
  });
}

export const config = {
  // Gjithçka përveç asete të brendshme të Next (/_next/*).
  matcher: ["/((?!_next/).*)"],
};
