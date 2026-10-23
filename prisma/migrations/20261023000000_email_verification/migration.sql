-- AlterTable: User — fusha të reja për verifikim të detyrueshëm të email-it.
--   emailVerified: false si parazgjedhje; vendoset true pas verifikimit (ose për Google me email_verified=true).
--   pendingRestaurantName: emri i restorantit ruhet në regjistrim; Restaurant-i krijohet VETËM pas verifikimit.
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "pendingRestaurantName" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill (grandfather) i KUFIZUAR i përdoruesve legacy.
--
-- KUJDES: data e krijimit NUK provon se një llogari është legacy e besuar. Prandaj
-- NUK përdorim cutoff sipas datës. Kriteri është AKTIVITET real që ekziston vetëm
-- te rrjedha e VJETËR: para këtij ndryshimi, regjistrimi krijonte menjëherë një
-- Restaurant; pra çdo pronar legacy ZOTËRON një Restaurant. Rrjedha e re NUK krijon
-- Restaurant derisa email-i të verifikohet, pra regjistrimet e reja të paverifikuara
-- nuk përputhen me këtë kriter dhe MBETEN false.
--
-- Përfshijmë edhe SUPER_ADMIN (seed-i fillestar mund të mos zotërojë Restaurant).
--
-- PARA aplikimit, operatori duhet të shqyrtojë bashkësinë e prekur (shih
-- docs/IMPLEMENTATION-STATUS.md për query-n e pamjes paraprake). Mos aplikoni live
-- pa këtë shqyrtim.
UPDATE "User" SET "emailVerified" = true
WHERE "emailVerified" = false
  AND (
    "role" = 'SUPER_ADMIN'
    OR "id" IN (SELECT "ownerId" FROM "Restaurant")
  );

-- CreateTable: EmailVerification — një rekord aktiv për user (userId unik), kredenciale të hash-uara.
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_userId_key" ON "EmailVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: RateLimit — rate limit i qëndrueshëm (i përbashkët për register/resend/verify).
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- Index për pastrimin e rreshtave të skaduar (prune periodik).
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
