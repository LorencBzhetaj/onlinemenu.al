import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureRestaurantWithTrial } from "@/lib/restaurant";

export const VERIFICATION_TTL_MS = 60 * 60 * 1000; // 1 orë
export const MAX_CODE_ATTEMPTS = 5; // tentativa të gabuara kodi para lock-ut (kërkohet ridërgim)

type Db = Prisma.TransactionClient | typeof prisma;

/** Hash determinist për token-in e linkut (entropi e lartë → SHA-256 mjafton, lookup i shpejtë). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Kod 6-shifror (000000–999999), zero-padded. */
function generateCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export type IssuedVerification = {
  token: string; // RAW — shkon te linku i email-it; NUK ruhet në DB (ruhet vetëm hash-i)
  code: string; // RAW — shkon te teksti i email-it; NUK ruhet në DB (ruhet vetëm hash-i)
};

/**
 * Krijon ose ri-krijon kredencialin e VETËM aktiv të verifikimit për një user.
 * Ridërgimi thërret të njëjtën: upsert mbi userId unik → token/kod/attempts/afat TË REJA,
 * pra kredenciali i vjetër (token+kod) bëhet automatikisht i pavlefshëm.
 */
export async function issueVerification(
  userId: string,
  db: Db = prisma
): Promise<IssuedVerification> {
  const token = randomBytes(32).toString("hex");
  const code = generateCode();
  const tokenHash = hashToken(token);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  await db.emailVerification.upsert({
    where: { userId },
    create: { userId, tokenHash, codeHash, expiresAt, attempts: 0, used: false },
    // Ri-dërgim: rrit versionin → anulon çdo konsumim në fluturim të kredencialit të vjetër.
    update: { tokenHash, codeHash, expiresAt, attempts: 0, used: false, version: { increment: 1 } },
  });

  return { token, code };
}

export type ConsumeInput = { token: string } | { email: string; code: string };

export type ConsumeResult =
  | { status: "ok"; user: { id: string; email: string; role: string } }
  | { status: "invalid" } // token/rekord s'ekziston
  | { status: "expired" } // skaduar ose tashmë i përdorur (replay)
  | { status: "wrong_code"; attemptsLeft: number }
  | { status: "locked" }; // tepër tentativa — kërko ridërgim

type RecordWithUser = Prisma.EmailVerificationGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        role: true;
        emailVerified: true;
        pendingRestaurantName: true;
      };
    };
  };
}>;

const userSelect = {
  id: true,
  email: true,
  role: true,
  emailVerified: true,
  pendingRestaurantName: true,
} as const;

/**
 * Konsumon ATOMIKISHT kredencialin e verifikimit dhe përfundon onboarding-un:
 *   1. gjen rekordin (me tokenHash, ose me userId të nxjerrë nga email),
 *   2. kontrollon skadim / përdorim / (për kodin) lock + përputhje kodi,
 *   3. CAS: updateMany(used:false, expiresAt>now → used:true) — VETËM një kërkesë fiton,
 *   4. brenda TË NJËJTIT transaksion: user.emailVerified=true + krijon Restaurant+trial.
 *
 * Dy kërkesa paralele (p.sh. linku dhe kodi njëkohësisht): vetëm njëra kalon CAS-in,
 * tjetra merr count=0 → rollback → "expired". Pra kurrë dy restorante ose dy trial.
 * Hapja GET e linkut NUK e thërret këtë — konsumimi bëhet vetëm nga një POST i përdoruesit.
 */
export async function consumeVerification(input: ConsumeInput): Promise<ConsumeResult> {
  const now = new Date();

  // 1) Gjej rekordin + user-in.
  let record: RecordWithUser | null = null;

  if ("token" in input) {
    const tokenHash = hashToken(input.token);
    record = await prisma.emailVerification.findUnique({
      where: { tokenHash },
      include: { user: { select: userSelect } },
    });
  } else {
    const email = String(input.email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      record = await prisma.emailVerification.findUnique({
        where: { userId: user.id },
        include: { user: { select: userSelect } },
      });
    }
  }

  if (!record) return { status: "invalid" };
  if (record.used || record.expiresAt < now) return { status: "expired" };

  // 2) Rruga e kodit: lock + verifikim i kodit (bcrypt) PARA konsumimit.
  if ("code" in input) {
    if (record.attempts >= MAX_CODE_ATTEMPTS) return { status: "locked" };

    const match = await bcrypt.compare(String(input.code).trim(), record.codeHash);
    if (!match) {
      const updated = await prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const attemptsLeft = Math.max(0, MAX_CODE_ATTEMPTS - updated.attempts);
      return attemptsLeft === 0 ? { status: "locked" } : { status: "wrong_code", attemptsLeft };
    }
  }

  // 3) + 4) Konsumim atomik + verifikim + krijim restoranti në një transaksion.
  try {
    const verifiedUser = await prisma.$transaction(async (tx) => {
      const cas = await tx.emailVerification.updateMany({
        // CAS i lidhur me VERSIONIN e lexuar: nëse një ri-dërgim (ose konsumim tjetër)
        // e ndryshoi rekordin mes leximit dhe këtu, version-i s'përputhet → count=0.
        where: { id: record!.id, version: record!.version, used: false, expiresAt: { gt: now } },
        data: { used: true },
      });
      // Humbi garën (konsumuar/ri-dërguar nga kërkesë paralele, ose skadoi ndërkohë).
      if (cas.count === 0) return null;

      await tx.user.update({
        where: { id: record!.userId },
        data: { emailVerified: true },
      });

      await ensureRestaurantWithTrial(
        tx,
        record!.userId,
        record!.user.pendingRestaurantName?.trim() || "Restoranti im"
      );

      return record!.user;
    });

    if (!verifiedUser) return { status: "expired" };
    return {
      status: "ok",
      user: { id: verifiedUser.id, email: verifiedUser.email, role: verifiedUser.role },
    };
  } catch (err) {
    console.error("consumeVerification tx error", err);
    return { status: "invalid" };
  }
}
