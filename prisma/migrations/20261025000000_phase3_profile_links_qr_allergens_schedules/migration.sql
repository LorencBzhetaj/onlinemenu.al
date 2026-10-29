-- Faza 3: profil publik + lidhje të jashtme + QR resolver + alergjenë + orare menuje
-- + disponueshmëri artikulli. Aplikohet VETËM në ambient të izoluar (jo prod/Neon live).

-- AlterTable: Restaurant — koordinata/hartë + përshkrim profili.
ALTER TABLE "Restaurant" ADD COLUMN "mapsUrl" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "aboutAl" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "aboutEn" TEXT;

-- AlterTable: Category — orar opsional i menusë.
ALTER TABLE "Category" ADD COLUMN "scheduleId" TEXT;

-- AlterTable: MenuItem — disponueshmëri (ndryshe nga dukshmëria).
ALTER TABLE "MenuItem" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: RestaurantExternalLink
CREATE TABLE "RestaurantExternalLink" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantExternalLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RestaurantExternalLink_restaurantId_type_key" ON "RestaurantExternalLink"("restaurantId", "type");
CREATE INDEX "RestaurantExternalLink_restaurantId_idx" ON "RestaurantExternalLink"("restaurantId");
ALTER TABLE "RestaurantExternalLink" ADD CONSTRAINT "RestaurantExternalLink_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: QrCode (një për restorant; kod opak)
CREATE TABLE "QrCode" (
    "code" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("code")
);
CREATE UNIQUE INDEX "QrCode_restaurantId_key" ON "QrCode"("restaurantId");
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Allergen
CREATE TABLE "Allergen" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "nameAl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Allergen_restaurantId_idx" ON "Allergen"("restaurantId");
ALTER TABLE "Allergen" ADD CONSTRAINT "Allergen_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: MenuItemAllergen (M:N)
CREATE TABLE "MenuItemAllergen" (
    "menuItemId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "MenuItemAllergen_pkey" PRIMARY KEY ("menuItemId", "allergenId")
);
CREATE INDEX "MenuItemAllergen_allergenId_idx" ON "MenuItemAllergen"("allergenId");
ALTER TABLE "MenuItemAllergen" ADD CONSTRAINT "MenuItemAllergen_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemAllergen" ADD CONSTRAINT "MenuItemAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: MenuSchedule
CREATE TABLE "MenuSchedule" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER[],
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,

    CONSTRAINT "MenuSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuSchedule_restaurantId_idx" ON "MenuSchedule"("restaurantId");
ALTER TABLE "MenuSchedule" ADD CONSTRAINT "MenuSchedule_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: Category.scheduleId → MenuSchedule (SetNull kur fshihet orari).
CREATE INDEX "Category_scheduleId_idx" ON "Category"("scheduleId");
ALTER TABLE "Category" ADD CONSTRAINT "Category_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MenuSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL (shqyrto para aplikimit; vetëm ambient i izoluar).
-- QR kod opak për çdo restorant ekzistues → `/q/[code]` çon te profili.
-- Përdor gen_random_uuid() (pgcrypto, standard në Neon/Postgres 16) pa viza për kod kompakt.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "QrCode" ("code","restaurantId","createdAt")
SELECT replace(gen_random_uuid()::text, '-', ''), r.id, now()
FROM "Restaurant" r
ON CONFLICT ("restaurantId") DO NOTHING;
