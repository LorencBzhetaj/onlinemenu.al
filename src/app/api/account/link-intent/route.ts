import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@/modules/accounts/oauth";
import { createLinkIntent, LINK_INTENT_COOKIE, LINK_INTENT_TTL_MS } from "@/modules/accounts/link-intent";

const FRESH_LOGIN_MS = 10 * 60 * 1000;

/**
 * Lidhja e qëllimshme e Google/Apple me llogarinë e kyçur. Rikonfirmim i identitetit:
 *  - me fjalëkalim, kur llogaria ka fjalëkalim;
 *  - përndryshe, hyrje e freskët (≤ 10 min) — ndryshe kërkohet "Hyni sërish".
 * Vendos një link intent (cookie HttpOnly, 10 min). Lidhja s'krijon restorant, trial, membership apo rol.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  const userId = session.user.id;

  if (!(await rateLimit(`link:user:${userId}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: "Shumë përpjekje. Provoni pas pak." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "") as OAuthProvider;
  const configured = authOptions.providers.map((p) => p.id);
  if (!(OAUTH_PROVIDERS as readonly string[]).includes(provider) || !configured.includes(provider)) {
    return NextResponse.json({ error: "Ky ofrues s'është i disponueshëm." }, { status: 400 });
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, emailVerified: true } });
  if (!me?.emailVerified) return NextResponse.json({ error: "Verifikoni email-in së pari." }, { status: 403 });

  if (me.passwordHash) {
    const ok = await bcrypt.compare(String(body.password ?? ""), me.passwordHash);
    if (!ok) return NextResponse.json({ error: "Fjalëkalimi i pasaktë." }, { status: 403 });
  } else {
    const token = await getToken({ req: req as Parameters<typeof getToken>[0]["req"], secret: process.env.NEXTAUTH_SECRET });
    const fresh = typeof token?.authTime === "number" && Date.now() - token.authTime <= FRESH_LOGIN_MS;
    if (!fresh) return NextResponse.json({ error: "reauth_required" }, { status: 403 });
  }

  const secure = new URL(req.url).protocol === "https:";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LINK_INTENT_COOKIE, createLinkIntent(userId, provider), {
    httpOnly: true,
    secure,
    // Apple kthehet me POST nga domeni i vet → SameSite=None (vetëm në HTTPS).
    sameSite: secure ? "none" : "lax",
    path: "/",
    maxAge: Math.floor(LINK_INTENT_TTL_MS / 1000),
  });
  return res;
}
