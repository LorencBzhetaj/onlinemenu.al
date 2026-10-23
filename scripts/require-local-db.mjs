/*
 * Guard: refuzon nëse DATABASE_URL OSE DIRECT_URL s'janë lokale (ose duken remote).
 * Përdoret PARA `prisma migrate deploy` në rrjedhat e testimit/zhvillimit, që asnjë
 * komandë migrimi të mos godasë prodhimin pa dashje.
 *
 * Kontrollohen TË DYJA variablat sepse `prisma migrate deploy` përdor `directUrl`
 * (DIRECT_URL) për të aplikuar migrimet — një DATABASE_URL lokal nuk mjafton.
 *
 * Anashkalim me vetëdije (jo i rekomanduar): ALLOW_NONLOCAL_TEST_DB=1
 */
const REMOTE = /neon\.tech|amazonaws|supabase|\.cloud|render\.com|railway|azure|gcp/i;
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/;

function isLocal(url) {
  if (!url) return false;
  return LOCAL.test(url) && !REMOTE.test(url);
}

function mask(url) {
  return (url ?? "(e pavendosur)").replace(/\/\/[^@]*@/, "//***@");
}

if (process.env.ALLOW_NONLOCAL_TEST_DB === "1") {
  console.warn("⚠️  ALLOW_NONLOCAL_TEST_DB=1 — guard-i i DB-së u anashkalua me vetëdije.");
  process.exit(0);
}

let bad = false;
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  const url = process.env[name];
  if (!isLocal(url)) {
    console.error(`⛔ ${name} s'duket lokale: "${mask(url)}"`);
    bad = true;
  }
}

if (bad) {
  console.error("Refuzohet: migrimet e testimit lejohen vetëm kundrejt një DB LOKALE (127.0.0.1/localhost).");
  console.error("Vendos DATABASE_URL dhe DIRECT_URL te DB lokale, ose (me rrezik) ALLOW_NONLOCAL_TEST_DB=1.");
  process.exit(2);
}

console.log("✓ DATABASE_URL dhe DIRECT_URL janë lokale — migrimi i testimit lejohet.");
