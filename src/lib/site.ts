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
