// Identitetet OAuth (Google/Apple) — vendimi i hyrjes, i ndarë nga NextAuth që të testohet.
//
// Rregulla:
//  1. Identiteti njihet VETËM nga (provider, providerAccountId). Email-i s'mjafton kurrë.
//  2. Lidhja me një llogari ekzistuese bëhet vetëm qëllimisht: nga faqja e llogarisë, pas
//     rikonfirmimit të identitetit (link intent i nënshkruar, jetëshkurtër).
//  3. Email që përputhet me një llogari ekzistuese → refuzim ("account_exists"): s'krijohet
//     përdorues i dytë dhe s'lidhet automatikisht. As llogaria e paverifikuar s'merret (pa
//     prekur fjalëkalimin e saj).
//  4. Përjashtim i vetëm (urë kalimi): llogari e krijuar më parë nga Google (pa fjalëkalim, e
//     verifikuar, pa asnjë identitet të lidhur) lidhet një herë me Google. Kurrë për Apple.
//  5. Përdorues i ri OAuth = rol "USER": pa restorant, trial, membership apo rol biznesi.
//  6. Kërkesat paralele: unikësia në DB (OAuthAccount + lower(email)) + rilexim pas konfliktit.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OAuthProvider = "google" | "apple";
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ["google", "apple"];

export type OAuthIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
};

export type OAuthDecision =
  | { ok: true; userId: string; how: "existing" | "linked" | "created" | "legacy_linked" }
  | { ok: false; reason: "account_exists" | "email_unverified" | "missing_email" | "link_conflict" };

/** Normalizimi i vetëm i email-it: hapësira + shkronja të vogla (pa hequr pika apo "+"). */
export function normalizeEmail(e: string | null | undefined): string | null {
  const v = (e ?? "").trim().toLowerCase();
  return v.includes("@") ? v : null;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function findAccount(provider: string, providerAccountId: string) {
  return prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { userId: true },
  });
}

async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, emailVerified: true, passwordHash: true, _count: { select: { oauthAccounts: true } } },
  });
}

export async function resolveOAuthSignIn(id: OAuthIdentity, linkIntentUserId: string | null = null): Promise<OAuthDecision> {
  const email = normalizeEmail(id.email);

  // 1) Identitet i njohur → hyrje te përdoruesi i lidhur (email-i aktual s'ka rëndësi; Apple mund ta ndryshojë).
  const known = await findAccount(id.provider, id.providerAccountId);
  if (known) {
    if (linkIntentUserId && known.userId !== linkIntentUserId) return { ok: false, reason: "link_conflict" };
    return { ok: true, userId: known.userId, how: "existing" };
  }

  // 2) Lidhje e qëllimshme nga llogaria (pas rikonfirmimit). S'krijon restorant/rol/membership.
  if (linkIntentUserId) {
    try {
      await prisma.oAuthAccount.create({
        data: { userId: linkIntentUserId, provider: id.provider, providerAccountId: id.providerAccountId, email },
      });
      return { ok: true, userId: linkIntentUserId, how: "linked" };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const again = await findAccount(id.provider, id.providerAccountId);
      return again?.userId === linkIntentUserId ? { ok: true, userId: linkIntentUserId, how: "linked" } : { ok: false, reason: "link_conflict" };
    }
  }

  // 3) Identitet i ri pa lidhje: duhet email i verifikuar nga ofruesi.
  if (!email) return { ok: false, reason: "missing_email" };
  if (!id.emailVerified) return { ok: false, reason: "email_unverified" };

  const existing = await findUserByEmail(email);
  if (existing) {
    // Garë: një kërkesë paralele mund ta ketë krijuar pikërisht këtë identitet ndërkohë → hyrje, jo refuzim.
    const raced = await findAccount(id.provider, id.providerAccountId);
    if (raced) return { ok: true, userId: raced.userId, how: "existing" };
    // 4) Urë kalimi vetëm për llogaritë e krijuara nga Google para këtij ndryshimi.
    const legacyGoogle = id.provider === "google" && existing.passwordHash === null && existing.emailVerified && existing._count.oauthAccounts === 0;
    if (!legacyGoogle) return { ok: false, reason: "account_exists" };
    try {
      await prisma.oAuthAccount.create({
        data: { userId: existing.id, provider: id.provider, providerAccountId: id.providerAccountId, email },
      });
      return { ok: true, userId: existing.id, how: "legacy_linked" };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const again = await findAccount(id.provider, id.providerAccountId);
      return again ? { ok: true, userId: again.userId, how: "existing" } : { ok: false, reason: "account_exists" };
    }
  }

  // 5) Përdorues i ri (rol USER) + identiteti — atomik.
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, role: "USER", emailVerified: true }, select: { id: true } });
      await tx.oAuthAccount.create({ data: { userId: u.id, provider: id.provider, providerAccountId: id.providerAccountId, email } });
      return u;
    });
    return { ok: true, userId: user.id, how: "created" };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Garë: një kërkesë paralele krijoi të njëjtin identitet (→ hyrje) ose të njëjtin email (→ refuzim).
    const again = await findAccount(id.provider, id.providerAccountId);
    return again ? { ok: true, userId: again.userId, how: "existing" } : { ok: false, reason: "account_exists" };
  }
}

/** Metodat e hyrjes së një përdoruesi (për faqen e llogarisë). */
export async function signInMethods(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, oauthAccounts: { select: { provider: true, email: true, createdAt: true } } },
  });
  return { hasPassword: Boolean(u?.passwordHash), oauth: u?.oauthAccounts ?? [] };
}
