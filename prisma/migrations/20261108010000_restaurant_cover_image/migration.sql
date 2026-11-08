-- Foto kopertine opsionale për profilin publik të restorantit.
-- Shtesë e pastër: kolonë nullable, pa backfill, pa ndikim te rreshtat ekzistues.
ALTER TABLE "Restaurant" ADD COLUMN "coverUrl" TEXT;
