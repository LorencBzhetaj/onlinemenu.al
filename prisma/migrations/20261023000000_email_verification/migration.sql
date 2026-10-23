-- AlterTable: User — fusha të reja për verifikim të detyrueshëm të email-it.
--   emailVerified: false si parazgjedhje; vendoset true pas verifikimit (ose për Google me email_verified=true).
--   pendingRestaurantName: emri i restorantit ruhet në regjistrim; Restaurant-i krijohet VETËM pas verifikimit.
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "pendingRestaurantName" TEXT;

-- Backfill (grandfather) i përdoruesve EKZISTUES — p.sh. admin@onlinemenu.al, lori@gmail.com —
-- që u krijuan PARA se të futej gate-i i verifikimit; përndryshe bllokohen nga login-i.
-- FILTËR i qëllimshëm sipas "createdAt": kështu një re-run teorik i këtij migrimi NUK verifikon
-- regjistrime të reja të paverifikuara (ato krijohen PAS kësaj date). Mos e hiq filtrin.
-- Data = mesnata (UTC) e ditës së këtij migrimi; çdo user real ekziston para saj.
UPDATE "User" SET "emailVerified" = true WHERE "createdAt" < TIMESTAMP '2026-10-23 00:00:00';

-- CreateTable: EmailVerification — një rekord aktiv për user (userId unik), kredenciale të hash-uara.
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
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
