/**
 * URL-ja bazë e platformës për metadata/canonical/sitemap/structured data (Faza 6).
 * Një burim i vetëm; pa trailing slash. Jashtë prod → localhost (pa dërgime reale).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Bashkon një path relativ me SITE_URL (idempotent ndaj trailing slash). */
export function absoluteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

/**
 * A lejohet indeksimi nga motorët e kërkimit (Faza 8). Default: PO. Staging/Preview
 * vendosin `NOINDEX=1` → gjithë faqja de-indeksohet (robots.txt disallow all + meta
 * noindex), që mjediset jo-prod të mos shfaqen te Google dhe të mos krijojnë përmbajtje
 * të dyfishtë. Vercel Preview mund ta vendosë automatikisht sipas `VERCEL_ENV`.
 */
export function indexingAllowed(): boolean {
  if (process.env.NOINDEX === "1") return false;
  // Mbrojtje shtesë: çdo mjedis Vercel jo-"production" de-indeksohet si parazgjedhje.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return false;
  return true;
}
