/**
 * Limiter i thjeshtë in-memory (best-effort).
 *
 * ⚠️ KUFIZIM SERVERLESS: në Vercel çdo instancë funksioni ka memorie të veten
 * dhe instancat janë ephemeral (fillojnë/vdesin) — pra ky limiter NUK është
 * i fortë kundër abuzimit të shpërndarë ose cold-start. Është vetëm linja e
 * parë e mbrojtjes kundër spam-it naiv nga një instancë e ngrohtë.
 *
 * FAZA 2: zëvendëso me Upstash Ratelimit (Redis) për limitim të vërtetë e të
 * qëndrueshëm mes instancave/rajoneve.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Kthen true nëse lejohet, false nëse është kaluar kufiri. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** Nxjerr IP-në e klientit nga headers (Vercel: x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
