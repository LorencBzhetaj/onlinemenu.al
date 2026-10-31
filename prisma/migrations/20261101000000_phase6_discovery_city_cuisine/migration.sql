-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "city" TEXT,
ADD COLUMN     "cuisine" TEXT;

-- CreateIndex
CREATE INDEX "Restaurant_isPublished_city_idx" ON "Restaurant"("isPublished", "city");

-- CreateIndex
CREATE INDEX "Restaurant_isPublished_cuisine_idx" ON "Restaurant"("isPublished", "cuisine");

