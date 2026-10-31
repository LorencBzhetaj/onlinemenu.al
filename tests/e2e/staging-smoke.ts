/*
 * Smoke-test për STAGING (Faza 8) — HTTP + browser, PA akses DB. Verifikon në hosting-un real:
 *   1) noindex (robots.txt disallow all),
 *   2) cron i njoftimeve i mbrojtur (pa secret → 401; me secret → 200),
 *   3) rrjedha kryesore rezervim → (manage) → anulim mbi një restorant demo të mbjellë,
 *   4) cron i njoftimeve përpunon pas rezervimit.
 *
 * Përdor të dhënat demo nga scripts/seed-staging.ts (slug default: te-gurra).
 * NUK prek DB direkt → mund ta ekzekutojë pronari vetëm me URL-në + CRON_SECRET-in staging.
 * Jeton te tests/e2e/ (jashtë tsc/npm test); nis me tsx.
 *
 * Përdorim:
 *   STAGING_BASE_URL=https://<staging> CRON_SECRET=<staging-cron> \
 *   [STAGING_SLUG=te-gurra] [PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium] \
 *   npx tsx tests/e2e/staging-smoke.ts
 */
import { launchBrowser } from "./_browser";

const BASE = (process.env.STAGING_BASE_URL || "").replace(/\/$/, "");
const SLUG = process.env.STAGING_SLUG || "te-gurra";
const CRON = process.env.CRON_SECRET || "";

if (!BASE) { console.error("⛔ STAGING_BASE_URL mungon."); process.exit(2); }

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

function futureDateKey(offDays: number): string {
  const d = new Date(Date.now() + offDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  console.log(`▶ Staging smoke → ${BASE}  (slug: ${SLUG})\n`);

  // ── 1) noindex (robots.txt) ──
  console.log("1. Indeksimi (robots.txt):");
  const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text()).catch(() => "");
  const disallowAll = /Disallow:\s*\/\s*$/m.test(robots) && !/Sitemap:/i.test(robots);
  ok("robots.txt bën disallow all (staging noindex)", disallowAll, "— vendos NOINDEX=1 në staging nëse dështon");

  // ── 2) Cron i njoftimeve i mbrojtur ──
  console.log("\n2. Cron i njoftimeve (auth):");
  const noAuth = await fetch(`${BASE}/api/cron/notifications`).then((r) => r.status).catch(() => 0);
  ok("pa secret → 401", noAuth === 401, `status=${noAuth}`);
  if (CRON) {
    const withAuth = await fetch(`${BASE}/api/cron/notifications`, { headers: { Authorization: `Bearer ${CRON}` } });
    const body = await withAuth.json().catch(() => ({}));
    ok("me secret → 200 ok", withAuth.status === 200 && body.ok === true, JSON.stringify(body).slice(0, 120));
  } else {
    console.log("  ⚠️ CRON_SECRET mungon → kapërceva kontrollin me-secret.");
  }

  // ── 3) Rezervim → manage → anulim (browser) ──
  console.log("\n3. Rrjedha rezervim → anulim:");
  const browser = await launchBrowser();
  const page = await (await browser.newContext()).newPage();
  try {
    await page.goto(`${BASE}/restaurants/${SLUG}/reserve`, { waitUntil: "networkidle" });
    await page.fill("input[type=date]", futureDateKey(4));
    await page.locator("select").first().selectOption("2");
    await page.getByRole("button", { name: /Shiko oraret/ }).click();
    await page.waitForSelector(".rsv-slot", { timeout: 10000 });
    ok("u shfaqën orë të lira", (await page.locator(".rsv-slot").count()) > 0);
    await page.locator(".rsv-slot").first().click();
    await page.getByRole("button", { name: /^Vazhdo$/ }).click();
    await page.locator(".rsv-card input").first().fill("Smoke Test");
    await page.locator("input[type=email]").fill("smoke@staging.demo");
    await page.locator(".rsv-card input").nth(2).fill("+355690000123");
    await page.getByRole("button", { name: /Konfirmo rezervimin/ }).click();
    await page.waitForSelector(".rsv-done", { timeout: 10000 });
    ok("rezervimi u konfirmua (.rsv-done)", (await page.locator(".rsv-done").count()) > 0);

    const manageHref = await page.locator('a.rsv-btn[href*="/bookings/"]').first().getAttribute("href").catch(() => null);
    ok("linku i menaxhimit u shfaq", !!manageHref, `href=${manageHref}`);
    if (manageHref) {
      const manageUrl = manageHref.startsWith("http") ? manageHref : `${BASE}${manageHref}`;
      page.on("dialog", (d) => d.accept());
      await page.goto(manageUrl, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Anulo rezervimin/ }).click();
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: "networkidle" });
      const txt = (await page.textContent("body")) || "";
      ok("rezervimi u anulua (statusi 'I anuluar')", txt.includes("I anuluar"), txt.slice(0, 80));
    }
  } finally {
    await browser.close();
  }

  // ── 4) Cron përpunon pas rezervimit ──
  if (CRON) {
    console.log("\n4. Cron përpunon pas rezervimit:");
    const r = await fetch(`${BASE}/api/cron/notifications`, { headers: { Authorization: `Bearer ${CRON}` } });
    const body = await r.json().catch(() => ({}));
    ok("cron 200 + përpunim i njoftimeve", r.status === 200 && body.ok === true, JSON.stringify(body).slice(0, 120));
  }

  console.log(`\n──────── STAGING SMOKE: ${pass} passed, ${fail} failed ────────`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
