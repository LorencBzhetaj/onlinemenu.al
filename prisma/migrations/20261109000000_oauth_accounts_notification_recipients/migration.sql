-- Faza 10: identitete OAuth (provider + providerAccountId), marrës njoftimesh dhe kanale.
-- Shtesë e pastër. PARA aplikimit në një DB me të dhëna: ekzekuto
--   npx tsx scripts/audit-email-conflicts.ts
-- Indeksi unik mbi lower(email) dështon (pa bashkuar llogari) nëse ka email-e që ndryshojnë vetëm
-- në shkronja të mëdha/vogla; zgjidhja bëhet manualisht, kurrë automatikisht.

-- AlterTable
ALTER TABLE "BookingSettings" ADD COLUMN     "notifyEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWhatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "NotificationJob" ADD COLUMN     "recipientId" TEXT;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "NotificationRecipient_restaurantId_idx" ON "NotificationRecipient"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_restaurantId_channel_address_key" ON "NotificationRecipient"("restaurantId", "channel", "address");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Unikësi e email-it të normalizuar (lowercase). Pa heqje pikash apo prapashtesash "+".
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
