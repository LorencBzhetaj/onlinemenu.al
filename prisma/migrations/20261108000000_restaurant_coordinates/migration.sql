-- Koordinata opsionale për pinin e restorantit në seksionin "Vendndodhja" të profilit.
-- Shtesë e pastër: kolona nullable, pa backfill, pa ndikim te rreshtat ekzistues.
ALTER TABLE "Restaurant" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Restaurant" ADD COLUMN "longitude" DOUBLE PRECISION;
