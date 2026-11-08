// "Link intent": provë jetëshkurtër (10 min) që një përdorues i kyçur, pas rikonfirmimit të
// identitetit, kërkoi të lidhë një ofrues OAuth. Ruhet në cookie HttpOnly, e nënshkruar me
// HMAC (NEXTAUTH_SECRET), e lidhur me userId + ofruesin; konsumohet (fshihet) pas përdorimit.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { OAuthProvider } from "./oauth";

export const LINK_INTENT_COOKIE = "om_link_intent";
export const LINK_INTENT_TTL_MS = 10 * 60 * 1000;

type Payload = { uid: string; provider: OAuthProvider; exp: number; n: string };

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET mungon");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createLinkIntent(uid: string, provider: OAuthProvider, now = Date.now()): string {
  const payload: Payload = { uid, provider, exp: now + LINK_INTENT_TTL_MS, n: randomBytes(12).toString("base64url") };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** Kthen userId-në vetëm kur nënshkrimi, ofruesi dhe afati janë të vlefshëm. */
export function readLinkIntent(value: string | undefined | null, provider: string, now = Date.now()): string | null {
  if (!value) return null;
  const [data, sig] = value.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    if (p.provider !== provider || typeof p.uid !== "string" || p.exp < now) return null;
    return p.uid;
  } catch {
    return null;
  }
}
