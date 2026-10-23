-- Faza 1: membership + rol + restorant aktiv + entitlement MENU/BOOKING + pezullim.

-- AlterTable: User — restoranti aktiv (vetëm default navigimi, jo autoritet lejesh).
ALTER TABLE "User" ADD COLUMN "activeRestaurantId" TEXT;

-- AlterTable: Restaurant — pezullim administrativ (null = jo i pezulluar).
ALTER TABLE "Restaurant" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- CreateTable: RestaurantMembership
CREATE TABLE "RestaurantMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RestaurantMembership_userId_restaurantId_key" ON "RestaurantMembership"("userId", "restaurantId");
CREATE INDEX "RestaurantMembership_restaurantId_idx" ON "RestaurantMembership"("restaurantId");
CREATE INDEX "RestaurantMembership_userId_idx" ON "RestaurantMembership"("userId");
ALTER TABLE "RestaurantMembership" ADD CONSTRAINT "RestaurantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantMembership" ADD CONSTRAINT "RestaurantMembership_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ModuleEntitlement
CREATE TABLE "ModuleEntitlement" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ModuleEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModuleEntitlement_subscriptionId_module_key" ON "ModuleEntitlement"("subscriptionId", "module");
ALTER TABLE "ModuleEntitlement" ADD CONSTRAINT "ModuleEntitlement_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL (shqyrto para aplikimit; aplikohet vetëm në ambient të izoluar).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Membership OWNER për çdo restorant ekzistues (invariant ownerId ↔ OWNER).
INSERT INTO "RestaurantMembership" ("id","userId","restaurantId","role","status","createdAt","updatedAt")
SELECT md5(random()::text || r.id), r."ownerId", r.id, 'OWNER', 'active', now(), now()
FROM "Restaurant" r
ON CONFLICT ("userId","restaurantId") DO NOTHING;

-- 2) Restoranti aktiv fillestar = i pari që zotëron (vetëm default navigimi).
UPDATE "User" u SET "activeRestaurantId" = (
  SELECT r.id FROM "Restaurant" r WHERE r."ownerId" = u.id ORDER BY r."createdAt" ASC LIMIT 1
) WHERE u."activeRestaurantId" IS NULL;

-- 3) Entitlement MENU — PASQYRON gjendjen e abonimit (NUK riaktivizon abonime joaktive).
--    expiresAt=NULL: moduli s'ka skadim të vetin; qeveris subscription-i (shih tabelën §5).
INSERT INTO "ModuleEntitlement" ("id","subscriptionId","module","status","expiresAt")
SELECT md5(random()::text || s.id || 'menu'), s.id, 'MENU',
       CASE WHEN s.status IN ('trial','active') THEN 'active' ELSE 'expired' END,
       NULL
FROM "Subscription" s
ON CONFLICT ("subscriptionId","module") DO NOTHING;

-- 4) Entitlement BOOKING — 'disabled' derisa moduli i booking-ut të integrohet (Faza 4/5).
INSERT INTO "ModuleEntitlement" ("id","subscriptionId","module","status","expiresAt")
SELECT md5(random()::text || s.id || 'booking'), s.id, 'BOOKING', 'disabled', NULL
FROM "Subscription" s
ON CONFLICT ("subscriptionId","module") DO NOTHING;
