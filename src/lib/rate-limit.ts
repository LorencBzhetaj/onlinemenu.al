/**
 * Rate limit i qëndrueshëm mbi PostgreSQL — i përbashkët për regjistrim, ridërgim
 * dhe verifikim. Ndryshe nga një limiter in-memory, mbahet mes instancave serverless
 * (çdo instancë ka memorie të vetën dhe janë ephemeral). Pa shërbim shtesë (Redis):
 * një tabelë e vetme `RateLimit` me një rresht për çelës.
 *
 * Çdo thirrje bën një upsert ATOMIK: brenda dritares rrit `count`; pas dritares e
 * rivendos në 1 me një `resetAt` të ri. Lejohet nëse `count <= limit`.
 */
import { prisma } from "@/lib/prisma";

/**
 * Kthen true nëse lejohet, false nëse u kalua kufiri brenda dritares.
 * Fail-open: nëse DB-ja dështon, lejon (nuk bllokon rrugën kritike) por logon.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt", "updatedAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}), now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < now()
                         THEN now() + make_interval(secs => ${windowSeconds})
                         ELSE "RateLimit"."resetAt" END,
        "updatedAt" = now()
      RETURNING "count"
    `;
    const count = Number(rows[0]?.count ?? 1);
    return count <= limit;
  } catch (err) {
    console.error("rateLimit DB error (fail-open):", err);
    return true;
  }
}

/** Fshin rreshtat e skaduar (thirret periodikisht nga cron-i). */
export async function pruneRateLimits(): Promise<number> {
  try {
    const n = await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now()`;
    return Number(n);
  } catch (err) {
    console.error("pruneRateLimits error:", err);
    return 0;
  }
}

/** Nxjerr IP-në e klientit nga headers (Vercel: x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Varianti për objektin `req` të NextAuth-it (authorize merr headers si objekt). */
export function clientIpFromHeaders(headers: Record<string, string | string[] | undefined> | undefined): string {
  if (!headers) return "unknown";
  const fwd = headers["x-forwarded-for"];
  const val = Array.isArray(fwd) ? fwd[0] : fwd;
  if (val) return String(val).split(",")[0].trim();
  const real = headers["x-real-ip"];
  return (Array.isArray(real) ? real[0] : real) ?? "unknown";
}
